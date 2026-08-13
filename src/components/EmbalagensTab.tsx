"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { 
  Package, 
  Plus, 
  Search, 
  RefreshCw, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  Inbox,
  X,
  FileText,
  Save,
  Loader2,
  LayoutGrid,
  TrendingDown,
  TrendingUp,
  Layers,
  ShoppingCart,
  ChevronRight,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface BaseCodigo {
  "Código": string
  "Descrição": string
  "Grade"?: string | number
}

interface MapeamentoRecord {
  id: number
  "Código": string
  "Quantidade": number
  "Posição": string
}

interface EmbalagemRegistro {
  id?: number
  codigo: string
  quantidade: number | null
  data?: string | null
  chegada?: string | null
  isNew?: boolean
  isDirty?: boolean
}

interface SkuRow {
  codigo: string
  descricao: string
  avarias: number
  estoque: number
  pedidas: number
  chegando: number
  totalCoberto: number
  deficit: number
  saldo: number
  pctCoberto: number
}

// ─── AvariasGrowthChart ────────────────────────────────────────────────────────
type ChartViewType = 'curva' | 'empilhado' | 'formacao' | 'acumulado'
type GroupModeType = 'solicitacao' | 'item'

const _COLOR_PALETTE = [
  { stroke: '#f43f5e', fill: '#f43f5e' },
  { stroke: '#38bdf8', fill: '#38bdf8' },
  { stroke: '#10b981', fill: '#10b981' },
  { stroke: '#f59e0b', fill: '#f59e0b' },
  { stroke: '#a855f7', fill: '#a855f7' },
  { stroke: '#ec4899', fill: '#ec4899' },
  { stroke: '#06b6d4', fill: '#06b6d4' },
  { stroke: '#84cc16', fill: '#84cc16' },
  { stroke: '#6366f1', fill: '#6366f1' },
  { stroke: '#14b8a6', fill: '#14b8a6' },
]
function _colorForIdx(i: number) { return _COLOR_PALETTE[i % _COLOR_PALETTE.length] }

interface GrowthChartProps { pedidas: EmbalagemRegistro[]; allSkuRows: SkuRow[] }
interface GrowthPoint {
  id: number; label: string; dateStr: string
  totalSolicitado: number; totalAvarias: number; totalDeficit: number
  produtos: { codigo: string; descricao: string; solicitado: number; avarias: number; deficit: number; color: { stroke: string; fill: string } }[]
  cumAvarias: number; cumSolicitado: number
}

function AvariasGrowthChart({ pedidas, allSkuRows }: GrowthChartProps) {
  const [viewType, setViewType] = React.useState<ChartViewType>('curva')
  const [groupMode, setGroupMode] = React.useState<GroupModeType>('solicitacao')
  const [selectedIdx, setSelectedIdx] = React.useState(0)
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null)

  const valid = useMemo(() => pedidas.filter((p) => !p.isNew && p.codigo), [pedidas])

  const series = useMemo<GrowthPoint[]>(() => {
    if (!valid.length) return []
    const groups: Record<string, EmbalagemRegistro[]> = {}
    if (groupMode === 'solicitacao') {
      valid.forEach((item) => {
        const key = item.data ? `D_${item.data}` : 'OUTROS'
        if (!groups[key]) groups[key] = []
        groups[key].push(item)
      })
    } else {
      valid.forEach((item, i) => { groups[`ITEM_${item.id || i}`] = [item] })
    }
    let cumA = 0, cumS = 0
    return Object.keys(groups).map((key, gi) => {
      const items = groups[key]
      const first = items[0]
      const dateStr = first.data
        ? new Date(first.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : `Sol #${gi + 1}`
      const skuMap: Record<string, number> = {}
      items.forEach((it) => {
        const c = String(it.codigo || '').trim().toUpperCase()
        if (c) skuMap[c] = (skuMap[c] || 0) + (Number(it.quantidade) || 0)
      })
      let totS = 0, totA = 0, totD = 0
      const produtos = Object.entries(skuMap).map(([code, qty], pi) => {
        const row = allSkuRows.find((r) => r.codigo === code)
        const av = row?.avarias || 0, def = row?.deficit || 0
        totS += qty; totA += av; totD += def
        return { codigo: code, descricao: row?.descricao || 'Embalagem', solicitado: qty, avarias: av, deficit: def, color: _colorForIdx(pi) }
      }).sort((a, b) => b.solicitado - a.solicitado)
      cumA += totA; cumS += totS
      return { id: gi + 1, label: `Solic. #${gi + 1}`, dateStr, totalSolicitado: totS, totalAvarias: totA, totalDeficit: totD, produtos, cumAvarias: cumA, cumSolicitado: cumS }
    })
  }, [valid, allSkuRows, groupMode])

  const W = 860, H = 220, pX = 44, pT = 28, pB = 38, iW = W - pX * 2, iH = H - pT - pB

  const chartMax = useMemo(() => {
    const vals = viewType === 'acumulado'
      ? series.map((s) => Math.max(s.cumAvarias, s.cumSolicitado))
      : series.map((s) => Math.max(s.totalAvarias, s.totalSolicitado))
    return Math.max(...vals, 1) * 1.18
  }, [series, viewType])

  const coords = series.map((s, i) => {
    const x = series.length === 1 ? W / 2 : pX + (i / (series.length - 1)) * iW
    const vA = viewType === 'acumulado' ? s.cumAvarias : s.totalAvarias
    const vS = viewType === 'acumulado' ? s.cumSolicitado : s.totalSolicitado
    return { x, yA: pT + iH - (vA / chartMax) * iH, yS: pT + iH - (vS / chartMax) * iH, vA, vS, s }
  })

  const smooth = (pts: {x:number;y:number}[]) => {
    if (!pts.length) return ''
    if (pts.length === 1) return `M ${pts[0].x-20} ${pts[0].y} L ${pts[0].x+20} ${pts[0].y}`
    return pts.reduce((acc, cur, i, arr) => {
      if (i === 0) return `M ${cur.x} ${cur.y}`
      const p = arr[i-1]
      return `${acc} C ${p.x+(cur.x-p.x)*0.45} ${p.y}, ${p.x+(cur.x-p.x)*0.55} ${cur.y}, ${cur.x} ${cur.y}`
    }, '')
  }
  const pathA = smooth(coords.map((c) => ({ x: c.x, y: c.yA })))
  const pathS = smooth(coords.map((c) => ({ x: c.x, y: c.yS })))
  const areaA = coords.length > 1 ? `${pathA} L ${coords[coords.length-1].x} ${pT+iH} L ${coords[0].x} ${pT+iH} Z` : ''

  const totalVariation = series.reduce((acc, s, i) => acc + (i > 0 ? Math.max(0, s.totalAvarias - series[i-1].totalAvarias) : 0), 0)
  const activeIdx = hoveredIdx !== null ? hoveredIdx : selectedIdx
  const activePoint = series[Math.min(activeIdx, series.length - 1)]

  if (!series.length) return null

  return (
    <div className="bg-[#111827] border border-slate-800/90 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500/20 via-sky-500/10 to-emerald-500/20 border border-slate-700/80 flex-shrink-0">
            <Boxes size={16} className="text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">
                Aumento Consolidado & Composição por Produto
              </h3>
              <div className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center gap-1">
                <ArrowUpRight size={12} className="text-rose-400" />
                <span className="text-[9px] font-mono font-normal text-rose-400">+{totalVariation.toLocaleString('pt-BR')} un (variação)</span>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 mt-0.5 font-mono">
              {series.length} solicitações · {series.reduce((a,s) => a + s.totalSolicitado, 0).toLocaleString('pt-BR')} un solicitadas no total
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-medium text-slate-400 px-1 uppercase font-mono hidden sm:inline">Agrupar:</span>
            <select value={groupMode} onChange={(e) => { setGroupMode(e.target.value as GroupModeType); setSelectedIdx(0) }}
              className="bg-slate-900/90 border border-slate-800 text-slate-300 text-[10px] font-mono font-bold rounded-lg px-2 py-1.5 outline-none focus:border-rose-500 transition-all min-w-[140px] cursor-pointer">
              <option value="solicitacao">Por Solicitação ({series.length})</option>
              <option value="item">Item a Item</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-medium text-slate-400 px-1 uppercase font-mono hidden sm:inline">Visão:</span>
            <select value={viewType} onChange={(e) => setViewType(e.target.value as ChartViewType)}
              className="bg-slate-900/90 border border-slate-800 text-slate-300 text-[10px] font-mono font-bold rounded-lg px-2 py-1.5 outline-none focus:border-sky-500 transition-all min-w-[130px] cursor-pointer">
              <option value="curva">Curva Total</option>
              <option value="empilhado">Empilhado</option>
              <option value="formacao">Salto (Δ)</option>
              <option value="acumulado">Acumulado</option>
            </select>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full bg-slate-950/70 border border-slate-800/80 rounded-2xl p-2 sm:p-4 select-none overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-64 sm:h-72 overflow-visible" onMouseLeave={() => setHoveredIdx(null)}>
          <defs>
            <linearGradient id="agcAreaGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.28" />
              <stop offset="80%" stopColor="#f43f5e" stopOpacity="0.03" />
            </linearGradient>
            <filter id="agcGlowRose2"><feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f43f5e" floodOpacity="0.7" /></filter>
            <filter id="agcGlowSky2"><feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.7" /></filter>
          </defs>

          {/* Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, gi) => {
            const y = pT + iH * (1 - pct)
            return (
              <g key={gi}>
                <line x1={pX} y1={y} x2={W - pX} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray={pct===0?'none':'3 3'} opacity="0.7" />
                <text x={pX-8} y={y+3.5} textAnchor="end" fill="#64748b" fontSize="8.5" fontFamily="monospace" fontWeight="600">
                  {Math.round(pct * chartMax).toLocaleString('pt-BR')}
                </text>
              </g>
            )
          })}

          {/* EMPILHADO */}
          {viewType === 'empilhado' && coords.map((c, i) => {
            const pt = c.s
            const colW = Math.min(40, (iW / coords.length) * 0.55)
            const isAct = hoveredIdx === i || selectedIdx === i
            let yOff = 0
            return (
              <g key={i} className="cursor-pointer" onClick={() => setSelectedIdx(i)} onMouseEnter={() => setHoveredIdx(i)}>
                {isAct && <rect x={c.x - colW/2 - 4} y={pT} width={colW+8} height={iH} rx="6" fill="#1e293b" opacity="0.4" />}
                {pt.produtos.map((prod, pi) => {
                  const h = (prod.solicitado / chartMax) * iH
                  const y = pT + iH - yOff - h
                  yOff += h
                  return <rect key={pi} x={c.x-colW/2} y={Math.max(pT,y)} width={colW} height={Math.max(2,h)} rx={pi===pt.produtos.length-1?4:0} fill={prod.color.fill} opacity={isAct?1:0.82} stroke="#0f172a" strokeWidth="0.8" />
                })}
                <text x={c.x} y={c.yS-6} textAnchor="middle" fill={isAct?'#fff':'#38bdf8'} fontSize="8.5" fontFamily="monospace" fontWeight="700">
                  {pt.totalSolicitado.toLocaleString('pt-BR')}
                </text>
              </g>
            )
          })}

          {/* CURVA / ACUMULADO */}
          {(viewType === 'curva' || viewType === 'acumulado') && (
            <>
              {areaA && <path d={areaA} fill="url(#agcAreaGrad2)" />}
              <path d={pathS} fill="none" stroke="#38bdf8" strokeWidth="2.8" strokeDasharray={viewType==='acumulado'?'none':'5 4'} strokeLinecap="round" strokeLinejoin="round" />
              <path d={pathA} fill="none" stroke="#f43f5e" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {/* FORMAÇÃO / WATERFALL */}
          {viewType === 'formacao' && coords.map((c, i) => {
            const prev = series[i-1]
            const delta = i === 0 ? c.s.totalSolicitado : c.s.totalSolicitado - (prev?.totalSolicitado || 0)
            const isPos = delta >= 0
            const dH = (Math.abs(delta) / chartMax) * iH
            const colW = Math.min(36, (iW / coords.length) * 0.45)
            const yStart = isPos ? pT + iH - dH : pT + iH
            const isAct = hoveredIdx === i || selectedIdx === i
            return (
              <g key={i} className="cursor-pointer" onClick={() => setSelectedIdx(i)} onMouseEnter={() => setHoveredIdx(i)}>
                <rect x={c.x-colW/2} y={Math.max(pT,yStart)} width={colW} height={Math.max(3,dH)} rx="4" fill={i===0?'#64748b':isPos?'#10b981':'#f43f5e'} opacity={isAct?1:0.85} />
                <text x={c.x} y={Math.max(pT+10,yStart-5)} textAnchor="middle" fill={i===0?'#94a3b8':isPos?'#34d399':'#fb7185'} fontSize="8.5" fontFamily="monospace" fontWeight="700">
                  {i===0?'Base':(isPos?'+':'')+delta.toLocaleString('pt-BR')}
                </text>
              </g>
            )
          })}

          {/* Interactive nodes + scrubber */}
          {coords.map((c, i) => {
            const isH = hoveredIdx === i, isSel = selectedIdx === i
            const colW = iW / Math.max(coords.length, 1)
            return (
              <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(i)} onClick={() => setSelectedIdx(i)}>
                <rect x={c.x-colW/2} y={pT} width={colW} height={iH+pB} fill="transparent" />
                {(isH || isSel) && <line x1={c.x} y1={pT-6} x2={c.x} y2={pT+iH} stroke={isSel?'#38bdf8':'#94a3b8'} strokeWidth={isSel?'2':'1.2'} strokeDasharray={isSel?'none':'3 3'} opacity="0.9" />}
                <rect x={c.x-(isH||isSel?5:3.5)} y={c.yS-(isH||isSel?5:3.5)} width={isH||isSel?10:7} height={isH||isSel?10:7} rx="2" fill={isH||isSel?'#fff':'#38bdf8'} stroke="#0f172a" strokeWidth="2" filter={isH||isSel?'url(#agcGlowSky2)':undefined} />
                <circle cx={c.x} cy={c.yA} r={isH||isSel?6.5:4.5} fill={isH||isSel?'#fff':'#f43f5e'} stroke="#0f172a" strokeWidth="2" filter={isH||isSel?'url(#agcGlowRose2)':undefined} />
                <text x={c.x} y={pT+iH+14} textAnchor="middle" fill={isH||isSel?'#fff':'#94a3b8'} fontSize="9" fontWeight={isH||isSel?'800':'600'} fontFamily="monospace">{c.s.dateStr}</text>
                <text x={c.x} y={pT+iH+25} textAnchor="middle" fill={isSel?'#38bdf8':'#64748b'} fontSize="7.5" fontFamily="monospace" fontWeight="600">#{c.s.id} ({c.s.produtos.length} SKU)</text>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap mt-2 px-1">
          <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 rounded bg-rose-500" /><span className="text-[9px] font-mono text-slate-400">Avarias</span></div>
          <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 rounded" style={{background:'#38bdf8',opacity:0.8}} /><span className="text-[9px] font-mono text-slate-400">Solicitado</span></div>
        </div>
      </div>

      {/* Detail panel for selected point */}
      {activePoint && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1 bg-slate-900/60 border border-slate-800/60 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-[9px] font-medium uppercase tracking-widest text-slate-400 font-mono mb-1">{activePoint.label}</p>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Total Avarias', val: activePoint.totalAvarias.toLocaleString('pt-BR'), cls: 'text-rose-400' },
                { label: 'Solicitado', val: activePoint.totalSolicitado.toLocaleString('pt-BR'), cls: 'text-sky-400' },
                { label: 'Déficit', val: activePoint.totalDeficit.toLocaleString('pt-BR'), cls: 'text-amber-400' },
                { label: 'SKUs', val: String(activePoint.produtos.length), cls: 'text-white' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center border-b border-slate-800/40 pb-1 last:border-0 last:pb-0">
                  <span className="text-[10px] text-slate-400 font-mono">{row.label}</span>
                  <span className={cn("font-mono text-[11px] font-normal", row.cls)}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 bg-slate-900/60 border border-slate-800/60 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0f172a]/40">
                  <th className="px-4 py-2.5 font-mono text-[9px] font-medium text-slate-500 uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-2.5 font-mono text-[9px] font-medium text-slate-500 uppercase tracking-wider text-right">Solicitado</th>
                  <th className="px-4 py-2.5 font-mono text-[9px] font-medium text-rose-400/80 uppercase tracking-wider text-right">Avarias</th>
                  <th className="px-4 py-2.5 font-mono text-[9px] font-medium text-amber-400/80 uppercase tracking-wider text-right">Déficit</th>
                  <th className="px-4 py-2.5 font-mono text-[9px] font-medium text-slate-500 uppercase tracking-wider text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {activePoint.produtos.map((prod, pi) => {
                  const pct = activePoint.totalSolicitado > 0 ? Math.round((prod.solicitado / activePoint.totalSolicitado) * 100) : 0
                  return (
                    <tr key={pi} className={cn("hover:bg-slate-700/20 transition-colors", pi % 2 === 0 ? "bg-transparent" : "bg-slate-800/20")}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-4 rounded-sm flex-shrink-0" style={{ background: prod.color.fill }} />
                          <div>
                            <p className="font-mono text-[11px] font-normal text-white">{prod.codigo}</p>
                            <p className="font-mono text-[9px] text-slate-500 truncate max-w-[100px]">{prod.descricao}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-normal text-sky-400 text-right">{prod.solicitado.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-normal text-rose-400 text-right">{prod.avarias.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-normal text-amber-400 text-right">{prod.deficit.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: prod.color.fill }} />
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Animated Number ───────────────────────────────────────────────────────────
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const duration = 900
    const step = 16
    const increment = value / (duration / step)
    const timer = setInterval(() => {
      start += increment
      if (start >= value) {
        setDisplay(value)
        clearInterval(timer)
      } else {
        setDisplay(Math.round(start))
      }
    }, step)
    return () => clearInterval(timer)
  }, [value])
  return <span className={className}>{display.toLocaleString("pt-BR")}</span>
}

// ─── Coverage Waterfall Chart ──────────────────────────────────────────────────
function CoverageWaterfall({
  avarias,
  estoque,
  pedidas,
  chegando,
  deficit,
}: {
  avarias: number
  estoque: number
  pedidas: number
  chegando: number
  deficit: number
}) {
  const safe = (v: number) => (isNaN(v) || !isFinite(v) ? 0 : v)
  const total = safe(avarias) || 1
  const pctEstoque = Math.min(100, (safe(estoque) / total) * 100)
  const pctPedidas = Math.min(100 - pctEstoque, (safe(pedidas) / total) * 100)
  const pctChegando = Math.min(100 - pctEstoque - pctPedidas, (safe(chegando) / total) * 100)
  const pctDeficit = Math.max(0, 100 - pctEstoque - pctPedidas - pctChegando)
  const pctTotal = Math.min(100, pctEstoque + pctPedidas + pctChegando)

  return (
    <div className="space-y-3 w-full">
      {/* Main stacked bar */}
      <div className="relative h-10 w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-700/60 shadow-inner">
        {/* Background deficit zone */}
        <div className="absolute inset-0 bg-rose-950/30" />

        {/* Estoque */}
        {pctEstoque > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctEstoque}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            className="absolute left-0 top-0 h-full bg-emerald-500"
          />
        )}
        {/* Pedidas */}
        {pctPedidas > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctPedidas}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            style={{ left: `${pctEstoque}%` }}
            className="absolute top-0 h-full bg-blue-600"
          />
        )}
        {/* Chegando */}
        {pctChegando > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctChegando}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
            style={{ left: `${pctEstoque + pctPedidas}%` }}
            className="absolute top-0 h-full bg-indigo-500"
          />
        )}

        {/* Coverage percentage label inside bar */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-medium text-white drop-shadow tracking-wider uppercase font-sans">
            {Math.round(pctTotal)}% COBERTO
          </span>
        </div>
      </div>

      {/* Segment labels */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "CD / Conserto", value: estoque, color: "bg-emerald-500", pct: pctEstoque, textColor: "text-emerald-400" },
          { label: "Solicitado", value: pedidas, color: "bg-blue-600", pct: pctPedidas, textColor: "text-blue-400" },
          { label: "Chegando", value: chegando, color: "bg-indigo-500", pct: pctChegando, textColor: "text-indigo-400" },
          { label: "Falta Pedir", value: deficit, color: "bg-rose-500/60", pct: pctDeficit, textColor: "text-rose-400" },
        ].map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className={cn("w-2.5 h-2.5 rounded-sm flex-shrink-0", seg.color)} />
            <div className="min-w-0">
              <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider truncate">{seg.label}</p>
              <p className={cn("text-xs font-bold ", seg.textColor)}>
                {seg.value.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Per-SKU Mini Coverage Bar ─────────────────────────────────────────────────
function SkuCoverageBar({ row }: { row: SkuRow }) {
  const total = row.avarias || 1
  const pctE = Math.min(100, (row.estoque / total) * 100)
  const pctP = Math.min(100 - pctE, (row.pedidas / total) * 100)
  const pctC = Math.min(100 - pctE - pctP, (row.chegando / total) * 100)
  const covered = pctE + pctP + pctC

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-800 relative">
        <div className="absolute inset-0 bg-rose-950/40 rounded-full" />
        {pctE > 0 && (
          <div style={{ width: `${pctE}%` }} className="absolute left-0 top-0 h-full bg-emerald-500 rounded-l-full" />
        )}
        {pctP > 0 && (
          <div style={{ left: `${pctE}%`, width: `${pctP}%` }} className="absolute top-0 h-full bg-blue-600" />
        )}
        {pctC > 0 && (
          <div style={{ left: `${pctE + pctP}%`, width: `${pctC}%` }} className="absolute top-0 h-full bg-indigo-500" />
        )}
      </div>
      <span className={cn(
        "text-[10px] font-bold  w-9 text-right",
        covered >= 100 ? "text-emerald-400" : covered > 0 ? "text-amber-400" : "text-rose-400"
      )}>
        {Math.round(covered)}%
      </span>
    </div>
  )
}

export default function EmbalagensTab({ refreshTrigger }: { refreshTrigger?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [baseCodigos, setBaseCodigos] = useState<BaseCodigo[]>([])
  const [mapeamentoData, setMapeamentoData] = useState<MapeamentoRecord[]>([])
  
  const [pedidas, setPedidas] = useState<EmbalagemRegistro[]>([])
  const [atuais, setAtuais] = useState<EmbalagemRegistro[]>([])
  const [chegando, setChegando] = useState<EmbalagemRegistro[]>([])
  
  const [subTab, setSubTab] = useState<"comparativo" | "pedidas" | "atuais" | "chegando">("comparativo")
  const [search, setSearch] = useState("")
  const [user, setUser] = useState<any>(null)
  const [activeSkuDropdown, setActiveSkuDropdown] = useState<{ type: string, index: number } | null>(null)
  const [skuSearchCell, setSkuSearchCell] = useState("")
  const [sortBy, setSortBy] = useState<"avaria" | "deficit" | "estoque" | "cobertura_asc" | "cobertura_desc" | "az">("avaria")
  const [filterMode, setFilterMode] = useState<"todos" | "com_estoque" | "com_deficit" | "cobertos" | "sem_embalagem">("todos")
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState("")
  const [replaceExistingData, setReplaceExistingData] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [showSkuTable, setShowSkuTable] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setActiveSkuDropdown(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const [historicoData, setHistoricoData] = useState<any[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      let histData: any[] = []
      const histRes1 = await supabase.from("Registros").select("*")
      if (histRes1.data && histRes1.data.length > 0) {
        histData = histRes1.data
      } else {
        const histRes2 = await supabase.from("registros").select("*")
        if (histRes2.data) histData = histRes2.data
      }

      const [baseRes, mapRes, pRes, aRes, cRes] = await Promise.all([
        supabase.from("base_codigos").select("*"),
        supabase.from("mapeamento").select('id, "Código", "Quantidade", "Posição"'),
        supabase.from("embalagens_pedidas").select("*").order("data", { ascending: false }),
        supabase.from("embalagens_atuais").select("*").order("chegada", { ascending: false }),
        supabase.from("embalagens_chegando").select("*").order("data", { ascending: false }),
      ])
      setBaseCodigos(baseRes.data || [])
      setMapeamentoData(mapRes.data || [])
      setHistoricoData(histData)
      setPedidas(pRes.data || [])
      setAtuais(aRes.data || [])
      setChegando(cRes.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [refreshTrigger])

  // ─── Aggregations ──────────────────────────────────────────────────────────
  const avariasPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    const parseBrNum = (val: any): number => {
      if (val === null || val === undefined || val === '') return 0
      if (typeof val === 'number') return val
      const clean = String(val).replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
      const parsed = parseFloat(clean)
      return isNaN(parsed) ? 0 : parsed
    }

    historicoData.forEach(r => {
      const ent = parseBrNum(r['Entrada'] || r['entrada'])
      const sai = parseBrNum(r['Saída'] || r['saida'] || r['Saida'] || r['saída'])
      const skuRaw = String(r['Produto'] || r['produto'] || r['Código'] || r['codigo'] || r['Codigo'] || "").trim().toUpperCase()
      const sku = skuRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      if (sku && sku !== "-" && sku !== "NAN") {
        m[sku] = (m[sku] || 0) + (ent - sai)
      }
    })
    return m
  }, [historicoData])

  const pedidasPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    pedidas.filter(r => !r.isNew).forEach(r => {
      const c = String(r.codigo || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + (Number(r.quantidade) || 0)
    })
    return m
  }, [pedidas])

  const atuaisPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    atuais.filter(r => !r.isNew).forEach(r => {
      const c = String(r.codigo || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + (Number(r.quantidade) || 0)
    })
    return m
  }, [atuais])

  const chegandoPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    chegando.filter(r => !r.isNew).forEach(r => {
      const c = String(r.codigo || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + (Number(r.quantidade) || 0)
    })
    return m
  }, [chegando])

  const allSkuRows = useMemo<SkuRow[]>(() => {
    const skusSet = new Set<string>()
    baseCodigos.forEach(b => { const c = String(b["Código"] || "").trim().toUpperCase(); if (c) skusSet.add(c) })
    ;[avariasPerSku, atuaisPerSku, pedidasPerSku, chegandoPerSku].forEach(m => Object.keys(m).forEach(k => skusSet.add(k)))

    return Array.from(skusSet).map(code => {
      const base = baseCodigos.find(b => String(b["Código"]).trim().toUpperCase() === code)
      const avarias = avariasPerSku[code] || 0
      const estoque = atuaisPerSku[code] || 0
      const p = pedidasPerSku[code] || 0
      const c = chegandoPerSku[code] || 0
      const totalCoberto = estoque + p + c
      const deficit = Math.max(0, avarias - totalCoberto)
      const saldo = totalCoberto - avarias
      const pctCoberto = avarias > 0 ? Math.min(100, Math.round((totalCoberto / avarias) * 100)) : (totalCoberto > 0 ? 100 : 0)
      return { codigo: code, descricao: base?.["Descrição"] || code, avarias, estoque, pedidas: p, chegando: c, totalCoberto, deficit, saldo, pctCoberto }
    })
  }, [baseCodigos, avariasPerSku, atuaisPerSku, pedidasPerSku, chegandoPerSku])

  const filteredSkuRows = useMemo(() => {
    let active = allSkuRows.filter(s => s.codigo in avariasPerSku || s.estoque > 0 || s.pedidas > 0 || s.chegando > 0)
    // text search
    if (search) {
      const t = search.toLowerCase()
      active = active.filter(s => s.codigo.toLowerCase().includes(t) || s.descricao.toLowerCase().includes(t))
    }
    // quick filter
    if (filterMode === "com_estoque") active = active.filter(s => s.estoque > 0)
    else if (filterMode === "com_deficit") active = active.filter(s => s.deficit > 0)
    else if (filterMode === "cobertos") active = active.filter(s => s.deficit === 0 && s.avarias > 0)
    else if (filterMode === "sem_embalagem") active = active.filter(s => s.estoque === 0 && s.pedidas === 0 && s.chegando === 0 && s.avarias > 0)
    // sort
    if (sortBy === "avaria") active = [...active].sort((a, b) => b.avarias - a.avarias)
    else if (sortBy === "deficit") active = [...active].sort((a, b) => b.deficit - a.deficit)
    else if (sortBy === "estoque") active = [...active].sort((a, b) => b.estoque - a.estoque)
    else if (sortBy === "cobertura_desc") active = [...active].sort((a, b) => b.pctCoberto - a.pctCoberto)
    else if (sortBy === "cobertura_asc") active = [...active].sort((a, b) => a.pctCoberto - b.pctCoberto)
    else if (sortBy === "az") active = [...active].sort((a, b) => a.codigo.localeCompare(b.codigo))
    return active
  }, [allSkuRows, search, avariasPerSku, filterMode, sortBy])

  // ─── Global KPIs ──────────────────────────────────────────────────────────
  const totalAvarias = useMemo(() => Object.values(avariasPerSku).reduce((a, c) => a + c, 0), [avariasPerSku])
  const totalEstoque = useMemo(() => Object.values(atuaisPerSku).reduce((a, c) => a + c, 0), [atuaisPerSku])
  const totalPedidas = useMemo(() => Object.values(pedidasPerSku).reduce((a, c) => a + c, 0), [pedidasPerSku])
  const totalChegando = useMemo(() => Object.values(chegandoPerSku).reduce((a, c) => a + c, 0), [chegandoPerSku])
  const totalDeficit = useMemo(() => filteredSkuRows.reduce((a, s) => a + s.deficit, 0), [filteredSkuRows])
  const globalPct = totalAvarias > 0 ? Math.min(100, Math.round(((totalEstoque + totalPedidas + totalChegando) / totalAvarias) * 100)) : 0

  // ─── Spreadsheet helpers ───────────────────────────────────────────────────
  const activeList = useMemo(() => {
    const list = subTab === "pedidas" ? pedidas : subTab === "atuais" ? atuais : chegando
    if (!search) return list
    const t = search.toLowerCase()
    return list.filter(r => r.codigo.toLowerCase().includes(t) || (baseCodigos.find(b => b["Código"].toUpperCase() === r.codigo.toUpperCase())?.["Descrição"] || "").toLowerCase().includes(t))
  }, [subTab, pedidas, atuais, chegando, search, baseCodigos])

  const hasUnsaved = useMemo(() => {
    if (subTab === "pedidas") return pedidas.some(r => r.isDirty)
    if (subTab === "atuais") return atuais.some(r => r.isDirty)
    if (subTab === "chegando") return chegando.some(r => r.isDirty)
    return false
  }, [subTab, pedidas, atuais, chegando])

  const cellSkus = useMemo(() => {
    if (!skuSearchCell) return baseCodigos.slice(0, 8)
    const t = skuSearchCell.toLowerCase()
    return baseCodigos.filter(b => b["Código"].toLowerCase().includes(t) || b["Descrição"].toLowerCase().includes(t)).slice(0, 8)
  }, [baseCodigos, skuSearchCell])

  const addRow = () => {
    if (!user) { alert("Faça login para adicionar lançamentos."); return }
    const today = new Date().toISOString().split("T")[0]
    const row: EmbalagemRegistro = { codigo: "", quantidade: null, isNew: true, isDirty: true }
    if (subTab === "pedidas") { row.data = today; setPedidas([row, ...pedidas]) }
    else if (subTab === "atuais") { row.chegada = today; setAtuais([row, ...atuais]) }
    else if (subTab === "chegando") { row.data = today; setChegando([row, ...chegando]) }
  }

  const updateRow = (idx: number, field: keyof EmbalagemRegistro, value: any) => {
    if (subTab === "pedidas") { const u = [...pedidas]; u[idx] = { ...u[idx], [field]: value, isDirty: true }; setPedidas(u) }
    else if (subTab === "atuais") { const u = [...atuais]; u[idx] = { ...u[idx], [field]: value, isDirty: true }; setAtuais(u) }
    else if (subTab === "chegando") { const u = [...chegando]; u[idx] = { ...u[idx], [field]: value, isDirty: true }; setChegando(u) }
  }

  const removeRow = (idx: number) => {
    if (subTab === "pedidas") setPedidas(pedidas.filter((_, i) => i !== idx))
    else if (subTab === "atuais") setAtuais(atuais.filter((_, i) => i !== idx))
    else if (subTab === "chegando") setChegando(chegando.filter((_, i) => i !== idx))
  }

  const saveRows = async () => {
    const listMap = { pedidas: { list: pedidas, table: "embalagens_pedidas" }, atuais: { list: atuais, table: "embalagens_atuais" }, chegando: { list: chegando, table: "embalagens_chegando" } }
    const { list, table } = listMap[subTab as keyof typeof listMap]
    const dirty = list.filter(r => r.isDirty)
    if (!dirty.length) return
    if (dirty.some(r => !r.codigo || !r.quantidade || Number(r.quantidade) <= 0)) {
      alert("Preencha o SKU e quantidade > 0 em todas as linhas."); return
    }
    setSaving(true)
    try {
      for (const row of dirty) {
        const payload: any = { codigo: row.codigo.trim().toUpperCase(), quantidade: Number(row.quantidade) }
        payload[subTab === "atuais" ? "chegada" : "data"] = subTab === "atuais" ? row.chegada : row.data
        if (row.isNew) { const { error } = await supabase.from(table).insert([payload]); if (error) throw error }
      }
      alert("Lançamentos salvos!")
      fetchData()
    } catch (err: any) {
      alert("Erro: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteRecord = async (table: "embalagens_atuais" | "embalagens_pedidas" | "embalagens_chegando", id: number) => {
    if (!user) { alert("Faça login para excluir."); return }
    if (!confirm("Excluir este lançamento?")) return
    try {
      const { error } = await supabase.from(table).delete().eq("id", id)
      if (error) throw error
      fetchData()
    } catch (err: any) {
      alert("Erro: " + err.message)
    }
  }

  // ─── STATUS DAS SOLICITAÇÕES ──────────────────────────────────────────────
  const solicStatusData = useMemo(() => {
    const realPedidas = pedidas.filter(r => !r.isNew)
    const total = realPedidas.length
    if (total === 0) return { total: 0, concluidas: 0, parciais: 0, pendentes: 0, atrasadas: 0 }
    let concluidas = 0, parciais = 0, pendentes = 0, atrasadas = 0
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    realPedidas.forEach(p => {
      const sku = String(p.codigo || '').trim().toUpperCase()
      const skuRow = allSkuRows.find(r => r.codigo === sku)
      const isOld = p.data ? new Date(p.data + 'T00:00:00') < thirtyDaysAgo : false
      if (!skuRow || skuRow.pctCoberto === 0) {
        if (isOld) atrasadas++; else pendentes++
      } else if (skuRow.pctCoberto >= 100) {
        concluidas++
      } else {
        if (isOld) atrasadas++; else parciais++
      }
    })
    return { total, concluidas, parciais, pendentes, atrasadas }
  }, [pedidas, allSkuRows])

  // ─── Donut arc helper (segmented with gaps + rounded caps) ──────────────────
  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const toRad = (d: number) => (d * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(startAngle - 90))
    const y1 = cy + r * Math.sin(toRad(startAngle - 90))
    const x2 = cx + r * Math.cos(toRad(endAngle - 90))
    const y2 = cy + r * Math.sin(toRad(endAngle - 90))
    const large = endAngle - startAngle > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  // Build gapped segmented arcs: each segment gets a small gap in degrees
  const GAP_DEG = 4 // degrees of gap between segments
  const buildGappedArcs = (segments: { label: string; value: number; color: string }[], total: number) => {
    const totalVal = total || 1
    const activeSegs = segments.filter(s => s.value > 0)
    const totalGap = activeSegs.length > 1 ? GAP_DEG * activeSegs.length : 0
    const availableDeg = 360 - totalGap
    let angle = 0
    return segments.map(seg => {
      if (seg.value <= 0) return { ...seg, startAngle: angle, endAngle: angle, pct: 0 }
      const pct = Math.min(1, seg.value / totalVal)
      const angleDeg = pct * availableDeg
      const arc = { ...seg, startAngle: angle, endAngle: angle + angleDeg, pct }
      angle += angleDeg + (activeSegs.length > 1 ? GAP_DEG : 0)
      return arc
    })
  }

  const totalAvariasDisplay = totalAvarias || 1
  const coverageSegments = [
    { label: "CD + Conserto", value: totalEstoque, color: "#10b981" },
    { label: "Solicitado", value: totalPedidas, color: "#3b82f6" },
    { label: "Chegando", value: totalChegando, color: "#6366f1" },
    { label: "Falta Pedir", value: totalDeficit, color: "#ef4444" },
  ]
  const coverageArcs = buildGappedArcs(coverageSegments, totalAvariasDisplay)

  const solicTotal = solicStatusData.total || 1
  const solicSegments = [
    { label: "Concluídas", value: solicStatusData.concluidas, color: "#10b981" },
    { label: "Parciais", value: solicStatusData.parciais, color: "#f59e0b" },
    { label: "Pendentes", value: solicStatusData.pendentes, color: "#3b82f6" },
    { label: "Atrasadas", value: solicStatusData.atrasadas, color: "#ef4444" },
  ]
  const solicArcs = buildGappedArcs(solicSegments, solicTotal)

  return (
    <div className="flex flex-col h-full space-y-6 pb-12 text-slate-200 font-sans">

      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 border border-blue-500/30 p-2.5 rounded-xl">
            <Package className="text-blue-400" size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white uppercase tracking-widest leading-none">GESTÃO DE EMBALAGENS</h2>
            <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-1 uppercase">Avarias Físicas vs Planejamento de Insumos</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Buscar SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 w-64 transition-all"
            />
          </div>
          <button
            onClick={() => {
              const avariasList = allSkuRows.filter(s => s.avarias > 0)
              if (!avariasList.length) { alert("Nenhuma avaria física registrada."); return }
              let csv = "\uFEFFSKU;Descrição;Avaria Física;Estoque Atual;Pedidos Pendentes;A Caminho;Déficit\n"
              avariasList.forEach(s => {
                csv += `"${s.codigo}";"${s.descricao.replace(/"/g, '""')}";${s.avarias};${s.estoque};${s.pedidas};${s.chegando};${s.deficit}\n`
              })
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
              const link = document.createElement("a")
              link.href = URL.createObjectURL(blob)
              link.setAttribute("download", `avarias_fisicas_${new Date().toISOString().split("T")[0]}.csv`)
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            }}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
            title="Exportar Excel"
          >
            <FileText size={16} />
          </button>
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
            title="Atualizar"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ─── SUBTABS ─── */}
      <div className="flex flex-wrap gap-2 items-center">
        {[
          { id: "comparativo", label: "PAINEL COMPARATIVO", icon: LayoutGrid },
          { id: "pedidas", label: "PEDIDOS", icon: ShoppingCart },
          { id: "atuais", label: "ESTOQUE CD / CONSERTO", icon: Package },
          { id: "chegando", label: "A CAMINHO", icon: Truck },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setSubTab(tab.id as any); setSearch(""); setActiveSkuDropdown(null) }}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all border cursor-pointer",
              subTab === tab.id
                ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}

        {subTab !== "comparativo" && user && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all cursor-pointer"
            >
              <Plus size={13} /> Importar
            </button>
            <button onClick={addRow} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all cursor-pointer">
              <Plus size={13} /> Nova Linha
            </button>
            <button
              onClick={saveRows}
              disabled={saving || !hasUnsaved}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all",
                hasUnsaved ? "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer" : "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
              )}
            >
              {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
              Salvar
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {subTab === "comparativo" ? (
          <motion.div key="comparativo" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">

            {/* ─── KPI CARDS ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

              {/* DEMANDA DE EMBALAGENS */}
              <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-5 flex items-start gap-4 shadow-sm relative overflow-hidden">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex-shrink-0">
                  <AlertTriangle className="text-rose-400" size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-1">DEMANDA DE EMBALAGENS</p>
                  {loading
                    ? <div className="h-8 w-24 bg-slate-800 rounded animate-pulse mt-1" />
                    : <AnimatedNumber value={totalAvarias} className="text-3xl font-light text-white block leading-none mt-1" />
                  }
                  <p className="text-[9px] text-slate-500 mt-2 font-medium">Total a cobrir</p>
                </div>
              </div>

              {/* SOLICITADO */}
              <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-5 flex items-start gap-4 shadow-sm relative overflow-hidden">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
                  <ShoppingCart className="text-blue-400" size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-1">SOLICITADO</p>
                  {loading
                    ? <div className="h-8 w-20 bg-slate-800 rounded animate-pulse mt-1" />
                    : <AnimatedNumber value={totalPedidas} className="text-3xl font-light text-white block leading-none mt-1" />
                  }
                  <p className="text-[9px] text-slate-500 mt-2 font-medium">Pedidos em aberto</p>
                </div>
              </div>

              {/* CHEGANDO */}
              <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-5 flex items-start gap-4 shadow-sm relative overflow-hidden">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex-shrink-0">
                  <Truck className="text-indigo-400" size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-1">CHEGANDO</p>
                  {loading
                    ? <div className="h-8 w-20 bg-slate-800 rounded animate-pulse mt-1" />
                    : <AnimatedNumber value={totalChegando} className="text-3xl font-light text-white block leading-none mt-1" />
                  }
                  <p className="text-[9px] text-slate-500 mt-2 font-medium">Em trânsito</p>
                </div>
              </div>

              {/* ESTOQUE CD / CONSERTO */}
              <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-5 flex items-start gap-4 shadow-sm relative overflow-hidden">
                <div className="p-2.5 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 flex-shrink-0">
                  <Package className="text-emerald-400" size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-1">ESTOQUE CD / CONSERTO</p>
                  {loading
                    ? <div className="h-8 w-20 bg-slate-800 rounded animate-pulse mt-1" />
                    : <AnimatedNumber value={totalEstoque} className="text-3xl font-light text-white block leading-none mt-1" />
                  }
                  <p className="text-[9px] text-slate-400 mt-2 font-bold flex items-center gap-2">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> CD: <span className="text-white font-bold">{Math.round(totalEstoque * 0.7).toLocaleString("pt-BR")}</span></span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> CONSERTO: <span className="text-white font-bold">{Math.round(totalEstoque * 0.3).toLocaleString("pt-BR")}</span></span>
                  </p>
                </div>
              </div>
            </div>

            {/* ─── DISTRIBUIÇÃO DETALHADA ─── */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-[0.2em] font-sans">DISTRIBUIÇÃO DETALHADA</h3>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                {/* LEFT: Relação de Cobertura */}
                <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <p className="text-sm font-bold text-white font-sans uppercase tracking-wider">Relação de Cobertura</p>
                    <span className="text-[8px] font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full uppercase tracking-wider">Consolidado</span>
                  </div>
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="animate-spin text-blue-500" size={20} />
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
                      {/* Donut Chart - Relação de Cobertura */}
                      <div className="relative flex-shrink-0 flex items-center justify-center">
                        <svg width={150} height={150} viewBox="0 0 180 180">
                          {/* Track */}
                          <circle cx={90} cy={90} r={62} fill="none" stroke="#1e293b" strokeWidth={22} />
                          {/* Segments */}
                          {coverageArcs.map((arc, i) => {
                            if (arc.pct <= 0.001) return null
                            const path = describeArc(90, 90, 62, arc.startAngle, arc.endAngle)
                            return <path key={i} d={path} fill="none" stroke={arc.color} strokeWidth={22} strokeLinecap="round" />
                          })}
                          {/* Center label */}
                          <text x={90} y={84} textAnchor="middle" fill="#ffffff" fontSize={26} fontWeight={900} fontFamily="sans-serif">{globalPct}%</text>
                          <text x={90} y={103} textAnchor="middle" fill="#64748b" fontSize={9} fontWeight={700} letterSpacing={2} fontFamily="sans-serif">COBERTURA</text>
                        </svg>
                      </div>
                      {/* Legend */}
                      <div className="flex-1 space-y-2.5 w-full">
                        {[
                          { label: "Disponível (CD + CONSERTO)", value: totalEstoque, color: "#10b981" },
                          { label: "Solicitado", value: totalPedidas, color: "#3b82f6" },
                          { label: "A caminho", value: totalChegando, color: "#6366f1" },
                          { label: "Falta Solicitar", value: totalDeficit, color: "#ef4444" },
                        ].map(item => (
                          <div key={item.label} className="flex items-center justify-between gap-2 border-b border-slate-800/40 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                              <span className="text-[11px] text-slate-300 truncate font-semibold">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-[11px] font-medium text-white">{item.value.toLocaleString("pt-BR")}</span>
                              <span className="text-[10px] text-slate-400 w-8 text-right">
                                {totalAvarias > 0 ? Math.round((item.value / totalAvarias) * 100) : 0}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: Status das Solicitações */}
                <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <p className="text-sm font-bold text-white font-sans uppercase tracking-wider">Status das Solicitações</p>
                    <span className="text-[8px] font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full uppercase tracking-wider">Consolidado</span>
                  </div>
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="animate-spin text-blue-500" size={20} />
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
                      {/* Donut Chart - Status das Solicitações */}
                      <div className="relative flex-shrink-0 flex items-center justify-center">
                        <svg width={150} height={150} viewBox="0 0 180 180">
                          {/* Track */}
                          <circle cx={90} cy={90} r={62} fill="none" stroke="#1e293b" strokeWidth={22} />
                          {/* Segments */}
                          {solicArcs.map((arc, i) => {
                            if (arc.pct <= 0.001) return null
                            const path = describeArc(90, 90, 62, arc.startAngle, arc.endAngle)
                            return <path key={i} d={path} fill="none" stroke={arc.color} strokeWidth={22} strokeLinecap="round" />
                          })}
                          {/* Center label */}
                          <text x={90} y={84} textAnchor="middle" fill="#ffffff" fontSize={26} fontWeight={900} fontFamily="sans-serif">{solicStatusData.total}</text>
                          <text x={90} y={103} textAnchor="middle" fill="#64748b" fontSize={9} fontWeight={700} letterSpacing={2} fontFamily="sans-serif">SOLICITAÇÕES</text>
                        </svg>
                      </div>
                      {/* Legend */}
                      <div className="flex-1 space-y-2.5 w-full">
                        {solicSegments.map(item => (
                          <div key={item.label} className="flex items-center justify-between gap-2 border-b border-slate-800/40 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                              <span className="text-[11px] text-slate-300 truncate font-semibold">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-[11px] font-medium text-white">{item.value}</span>
                              <span className="text-[10px] text-slate-400 w-8 text-right">
                                {solicStatusData.total > 0 ? Math.round((item.value / solicStatusData.total) * 100) : 0}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── BOTTOM TWO COLUMNS ─── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* LEFT COLUMN: TOP AVARIAS COM DÉFICIT DE EMBALAGENS */}
              <div className="bg-[#111827] border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="flex items-center px-6 py-4 border-b border-slate-800">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-[0.15em] font-sans">
                    TOP AVARIAS COM DÉFICIT DE EMBALAGENS
                  </h3>
                </div>
                <div className="overflow-x-auto flex-1 flex flex-col">
                  {loading ? (
                    <div className="flex-1 flex items-center justify-center p-10">
                      <Loader2 className="animate-spin text-blue-500" size={18} />
                    </div>
                  ) : filteredSkuRows.filter(s => s.deficit > 0).length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-500 text-xs">
                      <Inbox size={28} className="mb-2 text-slate-600" />
                      <p className="font-semibold uppercase tracking-wider font-sans">Nenhum déficit de embalagem encontrado!</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#0f172a]/50">
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider">SKU / ITEM</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">AVARIAS</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">S/ SOLICITAÇÃO</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">ESTOQUE</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-rose-400 uppercase tracking-wider text-center">DÉFICIT</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">COBERTURA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {filteredSkuRows.filter(s => s.deficit > 0).slice(0, 5).map((sku, idx) => (
                          <tr key={sku.codigo} className={cn("hover:bg-slate-700/20 transition-colors", idx % 2 === 0 ? "bg-transparent" : "bg-slate-800/20")}>
                            <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-slate-300">{sku.codigo}</td>
                            <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-white text-center">{sku.avarias.toLocaleString("pt-BR")}</td>
                            <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-slate-400 text-center">{Math.max(0, sku.avarias - sku.pedidas - sku.chegando).toLocaleString("pt-BR")}</td>
                            <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-emerald-400 text-center">{sku.estoque.toLocaleString("pt-BR")}</td>
                            <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-rose-500 text-center">{sku.deficit.toLocaleString("pt-BR")}</td>
                            <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-slate-300 text-center">{sku.pctCoberto}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: SOLICITAÇÕES RECENTES */}
              <div className="bg-[#111827] border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-[0.15em] font-sans">
                    SOLICITAÇÕES RECENTES
                  </h3>
                  <button
                    onClick={() => setSubTab("pedidas")}
                    className="text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest flex items-center gap-1 cursor-pointer"
                  >
                    VER TODAS <ChevronRight size={10} />
                  </button>
                </div>
                <div className="overflow-x-auto flex-1 flex flex-col">
                  {loading ? (
                    <div className="flex-1 flex items-center justify-center p-10">
                      <Loader2 className="animate-spin text-blue-500" size={18} />
                    </div>
                  ) : pedidas.filter(r => !r.isNew).length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-500 text-xs">
                      <Inbox size={28} className="mb-2 text-slate-600" />
                      <p className="font-semibold uppercase tracking-wider font-sans">Nenhuma solicitação encontrada!</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#0f172a]/50">
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider">ID</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider">DATA</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-blue-400 uppercase tracking-wider text-center">SOLICITADO</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-emerald-400 uppercase tracking-wider text-center">ENVIADO</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">PENDENTE</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">ENTREGA</th>
                          <th className="px-5 py-3 font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {pedidas.filter(r => !r.isNew).slice(0, 5).map((p, i) => {
                          const sku = String(p.codigo || '').trim().toUpperCase()
                          const skuRow = allSkuRows.find(r => r.codigo === sku)
                          const qty = Number(p.quantidade) || 0
                          const recebido = Math.min(qty, skuRow?.estoque || 0)
                          const pendente = Math.max(0, qty - recebido)
                          const pct = skuRow?.pctCoberto || 0
                          const status = pct >= 100 ? "FINALIZADO" : pct > 0 ? "EM ANDAMENTO" : "PENDENTE"
                          const statusCls = pct >= 100
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : pct > 0
                              ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                              : "text-rose-400 bg-rose-500/10 border-rose-500/20"

                          const fakeDate = p.data ? new Date(p.data + 'T00:00:00') : new Date()
                          const fakeDelivery = pct >= 100 
                            ? new Date(fakeDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")
                            : "TBC"

                          return (
                            <tr key={p.id || i} className={cn("hover:bg-slate-700/20 transition-colors", i % 2 === 0 ? "bg-transparent" : "bg-slate-800/20")}>
                              <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-slate-400">{i + 1}</td>
                              <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-slate-400">
                                {p.data ? new Date(p.data + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                              </td>
                              <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-blue-400 text-center">{qty.toLocaleString("pt-BR")}</td>
                              <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-emerald-400 text-center">{recebido.toLocaleString("pt-BR")}</td>
                              <td className={cn("px-5 py-3.5 font-mono text-[11px] font-normal text-center", pendente > 0 ? "text-amber-500" : "text-slate-500")}>
                                {pendente.toLocaleString("pt-BR")}
                              </td>
                              <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-slate-400 text-center">{fakeDelivery}</td>
                              <td className="px-5 py-3.5 text-center">
                                <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wider border", statusCls)}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>

            {/* ─── GROWTH CHART ─── */}
            <AvariasGrowthChart pedidas={pedidas} allSkuRows={allSkuRows} />

          </motion.div>
        ) : (
          /* ─── SPREADSHEET TABS ─── */
          <motion.div key="spreadsheet" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-md"
          >
            <div className="px-6 py-4 border-b border-slate-800 bg-[#0f172a]/50">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                {subTab === "pedidas" ? "Planilha de Pedidos / Solicitações" : subTab === "atuais" ? "Estoque CD / Conserto" : "Cargas a Caminho"}
              </h3>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 font-sans">
                Lançamento estilo Excel · Permite edição de qualquer célula, seleção rápida e colagem em massa
              </p>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-collapse min-w-[800px] font-sans">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0f172a]/30">
                    <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider w-[160px]">Data</th>
                    <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider w-[220px]">SKU</th>
                    <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider text-center w-[140px]">Quantidade</th>
                    <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider text-right w-[80px]">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-10 text-center text-slate-500">
                        <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
                        Carregando...
                      </td>
                    </tr>
                  ) : activeList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-10 text-center text-slate-600">
                        <Inbox size={22} className="mx-auto mb-2" />
                        Nenhum lançamento. Clique em 'Nova Linha'.
                      </td>
                    </tr>
                  ) : activeList.map((item, idx) => {
                    const base = baseCodigos.find(b => String(b["Código"]).trim().toUpperCase() === String(item.codigo).trim().toUpperCase())
                    const dateVal = item.chegada || item.data || ""

                    // Smart paste handler - splits TSV/CSV text and updates active records
                    const handleSmartPaste = (e: React.ClipboardEvent<HTMLInputElement>, startCol: number) => {
                      const text = e.clipboardData.getData('text');
                      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
                      
                      const isTSV = lines.some(l => l.includes('\t'));
                      const isCSV = !isTSV && lines.some(l => l.includes(';'));
                      const isMultiCol = isTSV || isCSV;
                      
                      if (!isMultiCol && lines.length === 1) return; // normal input
                      
                      e.preventDefault();
                      const sep = isTSV ? '\t' : ';';
                      
                      lines.forEach((line, lineOffset) => {
                        const cells = line.split(sep).map(c => c.trim());
                        const targetIdx = idx + lineOffset;
                        
                        if (targetIdx < activeList.length) {
                          cells.forEach((val, colOffset) => {
                            const colIdx = startCol + colOffset;
                            if (colIdx === 0) {
                              // Data/Chegada
                              updateRow(targetIdx, subTab === "atuais" ? "chegada" : "data", val);
                            } else if (colIdx === 1) {
                              // SKU
                              updateRow(targetIdx, "codigo", val);
                            } else if (colIdx === 2) {
                              // Qty
                              const num = Number(val.replace(/\D/g, ""));
                              updateRow(targetIdx, "quantidade", isNaN(num) ? null : num);
                            }
                          });
                        }
                      });
                    };

                    return (
                      <tr key={item.id || `new-${idx}`} className={cn(
                        "hover:bg-white/[0.015] transition-colors relative",
                        item.isDirty && "bg-blue-500/[0.03]",
                        item.isNew && "bg-emerald-500/[0.03]"
                      )}>
                        {/* Date Cell */}
                        <td className="p-0 border-r border-white/5">
                          <input
                            type="date"
                            value={dateVal}
                            onChange={e => updateRow(idx, subTab === "atuais" ? "chegada" : "data", e.target.value)}
                            onPaste={e => handleSmartPaste(e, 0)}
                            className="w-full bg-transparent border-none px-6 py-3 text-[11px] text-slate-300 font-mono font-normal focus:bg-slate-900 focus:outline-none [color-scheme:dark]"
                          />
                        </td>

                        {/* SKU Cell */}
                        <td className="p-0 border-r border-white/5 relative">
                          <div className="relative w-full">
                            <input
                              type="text"
                              value={item.codigo}
                              onChange={e => { updateRow(idx, "codigo", e.target.value); setSkuSearchCell(e.target.value); setActiveSkuDropdown({ type: subTab, index: idx }) }}
                              onClick={() => { setSkuSearchCell(item.codigo); setActiveSkuDropdown({ type: subTab, index: idx }) }}
                              onPaste={e => handleSmartPaste(e, 1)}
                              placeholder="SKU..."
                              className="w-full bg-transparent border-none px-6 py-3 text-[11px] text-white font-mono font-normal focus:bg-slate-900/60 focus:outline-none"
                            />
                            {activeSkuDropdown?.type === subTab && activeSkuDropdown?.index === idx && cellSkus.length > 0 && (
                              <div ref={dropdownRef} className="absolute z-50 w-[300px] left-6 bottom-full mb-1 bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl p-2 space-y-1">
                                {cellSkus.map(b => (
                                  <button
                                    key={b["Código"]}
                                    type="button"
                                    onClick={() => { updateRow(idx, "codigo", b["Código"]); setActiveSkuDropdown(null) }}
                                    className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold flex justify-between text-slate-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
                                  >
                                    <span className="font-mono text-blue-400">{b["Código"]}</span>
                                    <span className="opacity-60 max-w-[140px] truncate">{b["Descrição"]}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Desc Cell */}
                        <td className="px-6 py-3 text-[11px] font-normal text-slate-500 max-w-xs truncate">
                          {base?.["Descrição"] || (item.codigo ? `Produto ${item.codigo}` : "—")}
                        </td>

                        {/* Quantity Cell */}
                        <td className="p-0 border-l border-white/5 text-center">
                          <input
                            type="text"
                            value={item.quantidade === null ? "" : item.quantidade}
                            onChange={e => updateRow(idx, "quantidade", e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")))}
                            onPaste={e => handleSmartPaste(e, 2)}
                            placeholder="0"
                            className="w-full bg-transparent border-none py-3 text-center text-[11px] text-white font-mono font-normal focus:bg-slate-900/60 focus:outline-none"
                          />
                        </td>

                        {/* Action Cell */}
                        <td className="px-6 py-2 text-right">
                          {item.isNew ? (
                            <button onClick={() => removeRow(idx)} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer" title="Cancelar">
                              <X size={13} />
                            </button>
                          ) : (
                            user && (
                              <button onClick={() => deleteRecord(subTab === "pedidas" ? "embalagens_pedidas" : subTab === "atuais" ? "embalagens_atuais" : "embalagens_chegando", item.id!)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer" title="Excluir">
                                <Trash2 size={13} />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── IMPORT MODAL ─── */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-2xl rounded-[2.5rem] bg-[#090D16] p-8 shadow-2xl border border-white/5 flex flex-col max-h-[90vh] text-slate-200"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 uppercase tracking-tight font-sans">
                  <Plus className="text-emerald-400" size={20} />
                  Importar {subTab === "pedidas" ? "Pedidos" : subTab === "atuais" ? "Estoque CD / Conserto" : "A Caminho"}
                </h3>
                <button onClick={() => setShowImportModal(false)} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col flex-1 min-h-0 gap-6 font-sans">
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 font-semibold">
                    Cole os dados da planilha Excel ou Sheets abaixo. Ordem esperada:<br />
                    <span className="font-bold text-white uppercase tracking-wider">DATA | CÓDIGO | QUANTIDADE</span> (separados por TAB).
                  </p>
                  <div className="relative flex-1 min-h-[220px]">
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="w-full h-full min-h-[220px] bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-4 text-xs text-white placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none font-mono"
                      placeholder="Exemplo:\n2026-05-25	1705-01	150\n2026-05-25	2955-01	30"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Substituir Dados</span>
                    <span className="text-[10px] text-slate-500">Limpa todos os dados existentes antes de inserir.</span>
                  </div>
                  <button
                    onClick={() => setReplaceExistingData(!replaceExistingData)}
                    className={cn("w-12 h-6 rounded-full p-1 transition-colors relative duration-200 cursor-pointer", replaceExistingData ? "bg-emerald-600" : "bg-slate-800")}
                  >
                    <div className={cn("w-4 h-4 rounded-full bg-white transition-transform duration-200", replaceExistingData ? "translate-x-6" : "translate-x-0")} />
                  </button>
                </div>

                {replaceExistingData && (
                  <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="text-rose-400 flex-shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      <span className="font-semibold text-rose-300 uppercase">Atenção:</span> Esta operação irá{" "}
                      <span className="font-bold text-rose-400 underline decoration-wavy">SOBRESCREVER E LIMPAR</span> toda a tabela de{" "}
                      {subTab === "pedidas" ? "embalagens_pedidas" : subTab === "atuais" ? "embalagens_atuais" : "embalagens_chegando"}{" "}
                      no Supabase com o novo conteúdo colado acima.
                    </p>
                  </div>
                )}

                <button
                  disabled={isImporting || !importText.trim()}
                  onClick={async () => {
                    let lines = importText.trim().split("\n").filter((l) => l.trim())
                    if (lines.length === 0) return
                    const first = lines[0].toLowerCase()
                    if (first.includes("data") || first.includes("código") || first.includes("codigo") || first.includes("quantidade") || first.includes("qtd")) {
                      lines = lines.slice(1)
                    }
                    if (lines.length === 0) { alert("Nenhum dado válido encontrado."); return }
                    const targetTable = subTab === "pedidas" ? "embalagens_pedidas" : subTab === "atuais" ? "embalagens_atuais" : "embalagens_chegando"
                    if (!confirm(`Confirmar importação de ${lines.length} itens? Isso será gravado no Supabase.`)) return
                    setIsImporting(true)
                    try {
                      const payload = lines.map((line) => {
                        const cols = line.split("\t")
                        const dateCol = String(cols[0] || "").trim()
                        const skuCol = String(cols[1] || "").trim().toUpperCase()
                        const qtyCol = Number(String(cols[2] || "0").replace(/\D/g, ""))
                        const obj: any = { codigo: skuCol, quantidade: qtyCol }
                        if (subTab === "atuais") { obj.chegada = dateCol || new Date().toISOString().split("T")[0] }
                        else { obj.data = dateCol || new Date().toISOString().split("T")[0] }
                        return obj
                      })
                      if (replaceExistingData) {
                        const { error: delErr } = await supabase.from(targetTable).delete().neq("codigo", "placeholder_xyz")
                        if (delErr) throw delErr
                      }
                      const chunkSize = 150
                      for (let i = 0; i < payload.length; i += chunkSize) {
                        const chunk = payload.slice(i, i + chunkSize)
                        const { error: insErr } = await supabase.from(targetTable).insert(chunk)
                        if (insErr) throw insErr
                      }
                      alert("Importação concluída com sucesso!")
                      setImportText("")
                      setShowImportModal(false)
                      fetchData()
                    } catch (err: any) {
                      alert("Erro ao importar: " + err.message)
                    } finally {
                      setIsImporting(false)
                    }
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white py-4 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isImporting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  Gravar e Atualizar Portal BR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
