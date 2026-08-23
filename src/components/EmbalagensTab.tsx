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
  Hourglass,
  LayoutGrid,
  TrendingDown,
  TrendingUp,
  Layers,
  ShoppingCart,
  ChevronRight,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  Wrench,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"

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
  solicitacao?: string | null
  data_solicitacao?: string | null
  solicitante?: string | null
  destino?: string | null
  codigo_embalagem?: string | null
  descricao_embalagem?: string | null
  tipo?: string | null
  tipo_embalagem?: string | null
  modelo_produto?: string | null
  modelo?: string | null
  enviado?: number | null
  pendente?: number | null
  entrega_compras?: string | null
  envio_expedicao?: string | null
  status?: string | null
  comentario_tatiana?: string | null
  comentario?: string | null
  responsabilidade?: string | null
  nf?: string | null
  placa?: string | null
  previsao_entrega?: string | null
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

  // Coverage metrics: compare coverage with and without growth
  const firstSolAvarias = series.length > 0 ? series[0].totalAvarias : 0
  const lastSolAvarias = series.length > 0 ? series[series.length - 1].totalAvarias : 0
  const deltaAvarias = Math.max(0, lastSolAvarias - firstSolAvarias)
  const totalResources = allSkuRows.reduce((acc, r) => acc + (r.estoque || 0) + (r.pedidas || 0) + (r.chegando || 0), 0)
  const coverageWithoutGrowth = firstSolAvarias > 0 ? Math.min(100, Math.round((totalResources / firstSolAvarias) * 100)) : 0
  const coverageCurrent = lastSolAvarias > 0 ? Math.min(100, Math.round((totalResources / lastSolAvarias) * 100)) : 0

  if (!series.length) return null

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800/40">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 flex-shrink-0">
            <Boxes size={15} className="text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">
                Aumento Consolidado &amp; Composição por Produto
              </h3>
              <div className="px-2 py-0.5 rounded-full bg-rose-500/10 flex items-center gap-1">
                <ArrowUpRight size={12} className="text-rose-400" />
                <span className="text-[9px] font-mono font-normal text-rose-400">+{deltaAvarias.toLocaleString('pt-BR')} un desde 1ª sol.</span>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 mt-0.5 font-mono">
              {series.length} solicitações · {series.reduce((a,s) => a + s.totalSolicitado, 0).toLocaleString('pt-BR')} un solicitadas no total
            </p>
            {/* Coverage comparison strip */}
            {series.length > 1 && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-900/60 rounded-xl px-3 py-2">
                  <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Cobertura atual</div>
                  <div className={cn(
                    "text-[13px] font-semibold font-mono",
                    coverageCurrent >= 80 ? "text-emerald-400" : coverageCurrent >= 50 ? "text-amber-400" : "text-rose-400"
                  )}>{coverageCurrent}%</div>
                </div>
                <div className="text-[9px] text-slate-600">vs</div>
                <div className="flex items-center gap-2 bg-emerald-950/30 rounded-xl px-3 py-2">
                  <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Sem o crescimento</div>
                  <div className={cn(
                    "text-[13px] font-semibold font-mono",
                    coverageWithoutGrowth >= 80 ? "text-emerald-400" : coverageWithoutGrowth >= 50 ? "text-amber-400" : "text-rose-400"
                  )}>{coverageWithoutGrowth}%</div>
                  {coverageWithoutGrowth > coverageCurrent && (
                    <div className="flex items-center gap-0.5 text-emerald-400">
                      <ArrowUpRight size={10} />
                      <span className="text-[9px] font-mono">+{coverageWithoutGrowth - coverageCurrent}pp</span>
                    </div>
                  )}
                </div>
                <div className="text-[9px] text-slate-500 font-mono">
                  (desconsiderando +{deltaAvarias.toLocaleString('pt-BR')} avarias novas)
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-medium text-slate-500 px-1 uppercase font-mono hidden sm:inline">Agrupar:</span>
            <select value={groupMode} onChange={(e) => { setGroupMode(e.target.value as GroupModeType); setSelectedIdx(0) }}
              className="bg-slate-900/60 border border-slate-800/60 text-slate-300 text-[10px] font-mono font-bold rounded-lg px-2 py-1.5 outline-none focus:border-rose-500/50 transition-all min-w-[140px] cursor-pointer">
              <option value="solicitacao">Por Solicitação ({series.length})</option>
              <option value="item">Item a Item</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-medium text-slate-500 px-1 uppercase font-mono hidden sm:inline">Visão:</span>
            <select value={viewType} onChange={(e) => setViewType(e.target.value as ChartViewType)}
              className="bg-slate-900/60 border border-slate-800/60 text-slate-300 text-[10px] font-mono font-bold rounded-lg px-2 py-1.5 outline-none focus:border-sky-500/50 transition-all min-w-[130px] cursor-pointer">
              <option value="curva">Curva Total</option>
              <option value="empilhado">Empilhado</option>
              <option value="formacao">Salto (Δ)</option>
              <option value="acumulado">Acumulado</option>
            </select>
          </div>
        </div>
      </div>

      {/* SVG Chart — sem container com borda */}
      <div className="relative w-full select-none overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-64 sm:h-72 overflow-visible" onMouseLeave={() => setHoveredIdx(null)}>
          <defs>
            <linearGradient id="agcAreaGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#f43f5e" stopOpacity="0.18" />
              <stop offset="90%" stopColor="#f43f5e" stopOpacity="0.01" />
            </linearGradient>
            <filter id="agcGlowRose2"><feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f43f5e" floodOpacity="0.6" /></filter>
            <filter id="agcGlowSky2"><feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.6" /></filter>
          </defs>

          {/* Gridlines — sutis */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, gi) => {
            const y = pT + iH * (1 - pct)
            return (
              <g key={gi}>
                <line x1={pX} y1={y} x2={W - pX} y2={y} stroke="#1e293b" strokeWidth="0.7" strokeDasharray={pct===0?'none':'4 6'} opacity="0.5" />
                <text x={pX-8} y={y+3.5} textAnchor="end" fill="#475569" fontSize="8" fontFamily="monospace" fontWeight="500">
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
                {isAct && <rect x={c.x - colW/2 - 4} y={pT} width={colW+8} height={iH} rx="6" fill="#1e293b" opacity="0.3" />}
                {pt.produtos.map((prod, pi) => {
                  const h = (prod.solicitado / chartMax) * iH
                  const y = pT + iH - yOff - h
                  yOff += h
                  return <rect key={pi} x={c.x-colW/2} y={Math.max(pT,y)} width={colW} height={Math.max(2,h)} rx={pi===pt.produtos.length-1?4:0} fill={prod.color.fill} opacity={isAct?1:0.82} stroke="#0f172a" strokeWidth="0.5" />
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
              <path d={pathS} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray={viewType==='acumulado'?'none':'6 5'} strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
              <path d={pathA} fill="none" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
                {(isH || isSel) && <line x1={c.x} y1={pT-6} x2={c.x} y2={pT+iH} stroke={isSel?'#38bdf8':'#94a3b8'} strokeWidth={isSel?'1.5':'1'} strokeDasharray={isSel?'none':'4 4'} opacity="0.6" />}
                <rect x={c.x-(isH||isSel?5:3.5)} y={c.yS-(isH||isSel?5:3.5)} width={isH||isSel?10:7} height={isH||isSel?10:7} rx="2" fill={isH||isSel?'#fff':'#38bdf8'} stroke="#0f172a" strokeWidth="1.5" filter={isH||isSel?'url(#agcGlowSky2)':undefined} />
                <circle cx={c.x} cy={c.yA} r={isH||isSel?6:4} fill={isH||isSel?'#fff':'#f43f5e'} stroke="#0f172a" strokeWidth="1.5" filter={isH||isSel?'url(#agcGlowRose2)':undefined} />
                <text x={c.x} y={pT+iH+14} textAnchor="middle" fill={isH||isSel?'#e2e8f0':'#64748b'} fontSize="9" fontWeight={isH||isSel?'700':'500'} fontFamily="monospace">{c.s.dateStr}</text>
                <text x={c.x} y={pT+iH+25} textAnchor="middle" fill={isSel?'#38bdf8':'#475569'} fontSize="7.5" fontFamily="monospace" fontWeight="500">#{c.s.id} ({c.s.produtos.length} SKU)</text>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap mt-1 px-1">
          <div className="flex items-center gap-1.5"><div className="w-5 h-px rounded bg-rose-500" /><span className="text-[9px] font-mono text-slate-500">Avarias</span></div>
          <div className="flex items-center gap-1.5"><div className="w-5 h-px rounded" style={{background:'#38bdf8',opacity:0.7}} /><span className="text-[9px] font-mono text-slate-500">Solicitado</span></div>
        </div>
      </div>


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
  const [estoqueG300, setEstoqueG300] = useState<any[]>([])
  const [estoqueConserto, setEstoqueConserto] = useState<any[]>([])
  const [pedidosBa, setPedidosBa] = useState<any[]>([])
  const [togglingBa, setTogglingBa] = useState(false)
  
  const [subTab, setSubTab] = useState<"comparativo" | "pedidas" | "atuais" | "chegando" | "estoque_g300" | "conserto" | "ordem_pedido">("comparativo")
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
  const [expandedSolicitations, setExpandedSolicitations] = useState<Set<string>>(new Set())
  const [importedFileName, setImportedFileName] = useState("")
  const [showAddG300Modal, setShowAddG300Modal] = useState(false)
  const [addG300Search, setAddG300Search] = useState("")
  const [selectedBaItems, setSelectedBaItems] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [selectedSolicitantes, setSelectedSolicitantes] = useState<string[]>([])
  const uniqueSolicitantes = useMemo(() => Array.from(new Set(parsedRows.map(r => r.solicitante).filter(Boolean))) as string[], [parsedRows])

  const toggleBaixado = async (solicitacao: string, codigoProduto: string, codigoEmbalagem: string, rowId?: string | number) => {
    if (!user) {
      alert("Faça login para alterar o Status BA.");
      return;
    }
    const sol = String(solicitacao || "").trim();
    const prod = String(codigoProduto || "").trim().toUpperCase();
    const emb = String(codigoEmbalagem || "").trim().toUpperCase();
    
    if (!sol || !prod || !emb) {
      alert("Erro: Informações do pedido incompletas.");
      return;
    }

    setTogglingBa(true);
    try {
      // Se row_id disponível, usá-lo como chave primária para diferenciar linhas duplicadas
      const exists = pedidosBa.find(
        r => {
          if (rowId && r.row_id) {
            return String(r.row_id) === String(rowId);
          }
          return String(r.solicitacao).trim() === sol &&
                 String(r.codigo_produto).trim().toUpperCase() === prod &&
                 String(r.codigo_embalagem).trim().toUpperCase() === emb;
        }
      );

      if (exists) {
        // Remove BA
        const { error } = await supabase
          .from("pedidos_ba")
          .delete()
          .eq("id", exists.id);
        if (error) throw error;
      } else {
        // Add BA
        const insertData: any = { solicitacao: sol, codigo_produto: prod, codigo_embalagem: emb };
        if (rowId) insertData.row_id = String(rowId);
        const { error } = await supabase
          .from("pedidos_ba")
          .insert([insertData]);
        if (error) throw error;
      }
      
      // Refresh only the BA list
      const res = await supabase.from("pedidos_ba").select("*");
      setPedidosBa(res.data || []);
    } catch (err: any) {
      alert("Erro ao salvar Status BA: " + err.message);
    } finally {
      setTogglingBa(false);
    }
  };

  const handleExcelUpload = (file: File) => {
    setImportedFileName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase()
    
    const parseData = (rawText: string) => {
      const lines = rawText.split('\n').filter(l => l.trim() !== '')
      if (lines.length === 0) return
      
      const first = lines[0].toLowerCase()
      let dataLines = lines
      
      const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
      
      // Helper: exact match first, then substring (prevents "modelo" from hitting "modelo do produto" first)
      const getIndex = (aliases: string[]) => {
        // 1st pass: exact match
        const exact = headers.findIndex(h => aliases.some(alias => h === alias))
        if (exact !== -1) return exact
        // 2nd pass: substring fallback (only for aliases longer than 3 chars to avoid false positives)
        return headers.findIndex(h => aliases.some(alias => alias.length > 3 && h.includes(alias)))
      }

      const hasHeader = first.includes("solicitação") || first.includes("solicitacao") ||
                        first.includes("data") || first.includes("código") || first.includes("codigo") ||
                        first.includes("quantidade") || first.includes("qtd") || first.includes("solicitante");

      // Default indices (fallbacks) — order matching user's standard layout
      let headerIndices: Record<string, number> = {
        solicitacao: 0,
        data_solicitacao: 1,
        solicitante: 2,
        destino: 3,
        codigo_embalagem: 4,
        descricao_embalagem: 5,
        tipo_embalagem: 6,
        codigo: 7,
        modelo_produto: 8,
        modelo: 9,
        quantidade: 10,
        enviado: 11,
        pendente: 12,
        entrega_compras: 13,
        envio_expedicao: 14,
        status: 15,
        comentario_tatiana: -1,
        comentario: 16,
        responsabilidade: -1,
        nf: 17,
        placa: 18,
        previsao_entrega: 19
      }

      if (hasHeader) {
        dataLines = lines.slice(1)
        
        const dynIndices = {
          solicitacao:       getIndex(["solicitação", "solicitacao"]),
          data_solicitacao:  getIndex(["data solicitação", "data solicitacao", "data da solicitação", "data"]),
          solicitante:       getIndex(["solicitante"]),
          destino:           getIndex(["destino"]),
          codigo_embalagem:  getIndex(["codigo da embalagem", "código da embalagem", "cód. embalagem", "cod. embalagem"]),
          descricao_embalagem: getIndex(["descriçao da embalagem", "descrição da embalagem", "descricao da embalagem", "descrição embalagem", "descricao embalagem"]),
          tipo:              getIndex(["tipo"]),
          tipo_embalagem:    getIndex(["tipo de embalagem", "tipo embalagem"]),
          codigo:            getIndex(["codigo do produto", "código do produto", "cód. produto", "cod. produto"]),
          modelo_produto:    getIndex(["modelo do produto", "modelo produto"]),
          modelo:            getIndex(["modelo"]),
          quantidade:        getIndex(["solicitado.", "solicitado", "quantidade"]),
          enviado:           getIndex(["enviado.", "enviado"]),
          pendente:          getIndex(["pendente.", "pendente"]),
          entrega_compras:   getIndex(["entrega (compras)", "entrega compras", "entrega_compras"]),
          envio_expedicao:   getIndex(["envio (expedição)", "envio expedição", "envio expedicao", "envio_expedicao"]),
          status:            getIndex(["status"]),
          comentario_tatiana:getIndex(["comentário tatiana", "comentario tatiana", "tatiana"]),
          comentario:        getIndex(["comentário", "comentario"]),
          responsabilidade:  getIndex(["responsabilidade"]),
          nf:                getIndex(["nf", "nota fiscal", "n.f."]),
          placa:             getIndex(["placa"]),
          previsao_entrega:  getIndex(["previsão de entrega", "previsao de entrega", "previsão entrega", "previsao entrega"])
        }


        // Apply dynamic indices when found
        Object.entries(dynIndices).forEach(([key, val]) => {
          if (val !== -1) {
            headerIndices[key] = val
          }
        })
      }

      const payload = dataLines.map((line) => {
        const cols = line.split("\t")
        if (subTab === "pedidas") {
          const parseBrNum = (s: string) => {
            const clean = String(s || "0").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
            return Math.round(Number(clean) || 0);
          };
          
          const parseBrDateToIso = (s: string): string | null => {
            if (!s) return null;
            const str = s.trim();
            const parts = str.split(/[\/\-\.]/).filter(Boolean);
            if (parts.length === 3) {
              let [d, m, y] = parts;
              if (y.length === 2) y = `20${y}`;
              const yyyy = parseInt(y, 10);
              const mm = parseInt(m, 10);
              const dd = parseInt(d, 10);
              if (yyyy >= 2000 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
                const today = new Date();
                const currentYear = today.getFullYear();
                const currentMonth = today.getMonth() + 1;
                const currentDay = today.getDate();
                
                let finalM = mm;
                let finalD = dd;
                
                const isFuture = yyyy > currentYear || 
                                (yyyy === currentYear && mm > currentMonth) || 
                                (yyyy === currentYear && mm === currentMonth && dd > currentDay);
                                
                if (isFuture && dd <= 12) {
                  finalM = dd;
                  finalD = mm;
                }
                
                return `${yyyy}-${finalM.toString().padStart(2, '0')}-${finalD.toString().padStart(2, '0')}`;
              }
            }
            return null;
          };

          const getColVal = (key: string) => {
            const idx = headerIndices[key]
            return idx !== undefined && idx !== -1 && cols[idx] !== undefined ? String(cols[idx]).trim() : ""
          }

          const rawDate = getColVal("data_solicitacao")
          const dateCol = parseBrDateToIso(rawDate) || new Date().toISOString().split("T")[0];

          return {
            solicitacao: getColVal("solicitacao"),
            data_solicitacao: dateCol,
            data: dateCol, // Fallback for charts
            solicitante: getColVal("solicitante"),
            destino: getColVal("destino"),
            codigo_embalagem: getColVal("codigo_embalagem"),
            descricao_embalagem: getColVal("descricao_embalagem"),
            tipo: getColVal("tipo_embalagem"),
            tipo_embalagem: getColVal("tipo_embalagem"),
            codigo: getColVal("codigo").toUpperCase(), 
            modelo_produto: getColVal("modelo_produto"),
            modelo: getColVal("modelo"),
            quantidade: parseBrNum(getColVal("quantidade")), 
            enviado: parseBrNum(getColVal("enviado")),
            pendente: parseBrNum(getColVal("pendente")),
            entrega_compras: getColVal("entrega_compras"),
            envio_expedicao: getColVal("envio_expedicao"),
            status: getColVal("status"),
            comentario_tatiana: getColVal("comentario_tatiana"),
            comentario: getColVal("comentario"),
            responsabilidade: getColVal("responsabilidade"),
            nf: getColVal("nf"),
            placa: getColVal("placa"),
            previsao_entrega: getColVal("previsao_entrega"),
          };
        } else {
          const dateCol = String(cols[0] || "").trim()
          const skuCol = String(cols[1] || "").trim().toUpperCase()
          const qtyCol = Number(String(cols[2] || "0").replace(/\D/g, ""))
          const obj: any = { codigo: skuCol, quantidade: qtyCol }
          if (subTab === "atuais") { obj.chegada = dateCol || new Date().toISOString().split("T")[0] }
          else { obj.data = dateCol || new Date().toISOString().split("T")[0] }
          return obj
        }
      })
      setParsedRows(payload)
      
      // Auto-select all unique solicitantes
      if (subTab === "pedidas") {
        const unique = Array.from(new Set(payload.map(r => r.solicitante).filter(Boolean))) as string[]
        setSelectedSolicitantes(unique)
      }
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result
          const workbook = XLSX.read(data, { type: 'array' })
          // Procura a aba que contém coluna "solicitante" ou "solicitação" (não necessariamente a 1ª aba)
          let targetSheet = workbook.Sheets[workbook.SheetNames[0]]
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName]
            const preview = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' })
            const firstLine = preview.split('\n')[0]?.toLowerCase() || ''
            if (firstLine.includes('solicitante') || firstLine.includes('solicitação')) {
              targetSheet = sheet
              break
            }
          }
          const tsv = XLSX.utils.sheet_to_csv(targetSheet, { FS: '\t' })
          parseData(tsv)

        } catch (err: any) {
          alert('Erro ao ler o arquivo Excel: ' + err.message)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (evt) => parseData(evt.target?.result as string || '')
      reader.readAsText(file, 'UTF-8')
    }
  }

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

      try {
        const gRes = await supabase.from("estoque_g300").select("*").order("id", { ascending: true })
        if (gRes.data) setEstoqueG300(gRes.data)
      } catch (g300Err) {
        console.error("Failed to load estoque_g300:", g300Err)
      }
      try {
        const cRes = await supabase.from("estoque_conserto").select("*").order("id", { ascending: true })
        if (cRes.data) setEstoqueConserto(cRes.data)
      } catch (cErr) {
        console.error("Failed to load estoque_conserto:", cErr)
      }
      try {
        const baRes = await supabase.from("pedidos_ba").select("*")
        if (baRes.data) setPedidosBa(baRes.data)
      } catch (baErr) {
        console.error("Failed to load pedidos_ba:", baErr)
      }
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
      if (typeof val === 'number') return Math.round(val)
      const clean = String(val).replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
      const parsed = parseFloat(clean)
      return isNaN(parsed) ? 0 : Math.round(parsed)
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

  // ─── Helpers de Filtro Inteligente ─────────────────────────────────────────
  const ehMicroOndas = (modelo: string | null | undefined, modeloProduto: string | null | undefined, sku?: string): boolean => {
    let m = (modelo || modeloProduto || '').trim().toUpperCase()
    if (!m && sku) {
      const base = baseCodigos.find(b => String(b['Código']).trim().toUpperCase() === sku.toUpperCase())
      if (base) m = String(base['Descrição'] || '').trim().toUpperCase()
    }
    return m.startsWith('MO') || m.includes('MICRO')
  }

  const normalizarTipoEmb = (te: string | null | undefined): string => {
    return (te || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
  }

  // Regra central: deve incluir esta linha na Ordem de Pedido?
  const deveIncluirLinha = (r: EmbalagemRegistro): boolean => {
    const te = normalizarTipoEmb(r.tipo_embalagem)
    const desc = normalizarTipoEmb(r.descricao_embalagem)

    // Oculta embalagens coletivas da lista
    if (te.includes('COLETIVA') || desc.includes('COLETIVA')) return false

    // Para Micro-ondas, SÓ exibe o CALÇO SUPERIOR
    if (ehMicroOndas(r.modelo, r.modelo_produto, r.codigo)) {
      if (te.includes('SUPERIOR') || desc.includes('SUPERIOR')) return true
      return false
    }

    const tipo = String(r.tipo || '').trim().toUpperCase()
    if (tipo !== 'INSUMO') return true // EMBALAGEM → sempre inclui
    return te.includes('CALCO') || desc.includes('CALCO') // Calço sem acento → inclui
  }

  // Regra para KPIs/Cronograma: evita dupla contagem de kits e ignora coletivas temporariamente
  const deveContabilizarNoCronograma = (r: EmbalagemRegistro): boolean => {
    const te = normalizarTipoEmb(r.tipo_embalagem)
    const desc = normalizarTipoEmb(r.descricao_embalagem)
    
    // Regra Coletiva vs Individual: ignora coletivas
    if (te.includes('COLETIVA') || desc.includes('COLETIVA')) return false

    // Regra MO: contabiliza apenas o CALÇO SUPERIOR para representar o kit
    if (ehMicroOndas(r.modelo, r.modelo_produto, r.codigo)) {
      return te.includes('SUPERIOR') || desc.includes('SUPERIOR')
    }

    // Regra Não-MO: contabiliza EMBALAGEM (ou CALÇO, se for o único item)
    const tipo = String(r.tipo || '').trim().toUpperCase()
    return tipo !== 'INSUMO' || te.includes('CALCO') || desc.includes('CALCO')
  }

  // Compatibilidade antiga removida: const deveConsiderarInsumo = (r: any) => deveIncluirLinha(r as EmbalagemRegistro)

  const pedidasPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    // Somente pedidos NÃO finalizados E NÃO baixados (BA) contam como "Solicitado"
    pedidas.filter(r => !r.isNew && (r.status || "").trim().toUpperCase() !== "FINALIZADO" && deveContabilizarNoCronograma(r as EmbalagemRegistro)).forEach(r => {
      const sol = String(r.solicitacao || "").trim()
      const prod = String(r.codigo || "").trim().toUpperCase()
      const emb = String(r.codigo_embalagem || "").trim().toUpperCase()
      const isMarkedBa = pedidosBa.some(
        ba => String(ba.solicitacao).trim() === sol &&
              String(ba.codigo_produto).trim().toUpperCase() === prod &&
              String(ba.codigo_embalagem).trim().toUpperCase() === emb
      )
      if (isMarkedBa) return

      const c = String(r.codigo || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + Math.round(Number(r.quantidade) || 0)
    })
    return m
  }, [pedidas, pedidosBa])

  const atuaisPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    // estoqueG300 é o estoque do CD — agrupa por codigo_produto, soma cd
    estoqueG300.filter(r => !r.isNew && deveContabilizarNoCronograma(r as EmbalagemRegistro)).forEach(r => {
      const c = String(r.codigo_produto || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + Math.round(Number(r.cd) || 0)
    })
    return m
  }, [estoqueG300])

  const consertoPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    // estoqueConserto é o estoque do conserto — agrupa por codigo_produto, soma cd
    estoqueConserto.filter(r => !r.isNew && deveContabilizarNoCronograma(r as EmbalagemRegistro)).forEach(r => {
      const c = String(r.codigo_produto || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + Math.round(Number(r.cd) || 0)
    })
    return m
  }, [estoqueConserto])

  const chegandoPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    // Pedidos FINALIZADOS E NÃO baixados (BA) entram como "A Caminho"
    pedidas.filter(r => !r.isNew && (r.status || "").trim().toUpperCase() === "FINALIZADO" && deveContabilizarNoCronograma(r as EmbalagemRegistro)).forEach(r => {
      const sol = String(r.solicitacao || "").trim()
      const prod = String(r.codigo || "").trim().toUpperCase()
      const emb = String(r.codigo_embalagem || "").trim().toUpperCase()
      const isMarkedBa = pedidosBa.some(
        ba => String(ba.solicitacao).trim() === sol &&
              String(ba.codigo_produto).trim().toUpperCase() === prod &&
              String(ba.codigo_embalagem).trim().toUpperCase() === emb
      )
      if (isMarkedBa) return

      const c = String(r.codigo || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + Math.round(Number(r.quantidade) || 0)
    })
    chegando.filter(r => !r.isNew && deveContabilizarNoCronograma(r as EmbalagemRegistro)).forEach(r => {
      const c = String(r.codigo || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + Math.round(Number(r.quantidade) || 0)
    })
    return m
  }, [pedidas, chegando, pedidosBa])

  const enviadoNaoChegouPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    pedidas.filter(r => !r.isNew && (r.status || "").trim().toUpperCase() === "FINALIZADO" && deveContabilizarNoCronograma(r as EmbalagemRegistro)).forEach(r => {
      const sol = String(r.solicitacao || "").trim()
      const prod = String(r.codigo || "").trim().toUpperCase()
      const emb = String(r.codigo_embalagem || "").trim().toUpperCase()
      const isMarkedBa = pedidosBa.some(
        ba => String(ba.solicitacao).trim() === sol &&
              String(ba.codigo_produto).trim().toUpperCase() === prod &&
              String(ba.codigo_embalagem).trim().toUpperCase() === emb
      )
      if (isMarkedBa) return

      const c = String(r.codigo || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + Math.round(Number(r.quantidade) || 0)
    })
    return m
  }, [pedidas, pedidosBa])

  // Helper to find packaging code for a product SKU
  const getEmbCode = (prodCode: string) => {
    const g300Item = estoqueG300.find(r => String(r.codigo_produto).trim().toUpperCase() === prodCode.trim().toUpperCase())
    if (g300Item?.codigo_embalagem) return String(g300Item.codigo_embalagem).trim()
    
    const consertoItem = estoqueConserto.find(r => String(r.codigo_produto).trim().toUpperCase() === prodCode.trim().toUpperCase())
    if (consertoItem?.codigo_embalagem) return String(consertoItem.codigo_embalagem).trim()

    const pedidasItem = pedidas.find(r => String(r.codigo).trim().toUpperCase() === prodCode.trim().toUpperCase())
    if (pedidasItem?.codigo_embalagem) return String(pedidasItem.codigo_embalagem).trim()

    return ""
  }

  // Helper to find packaging description
  const getEmbDesc = (prodCode: string, embCode: string) => {
    const g300Item = estoqueG300.find(r => String(r.codigo_produto).trim().toUpperCase() === prodCode.trim().toUpperCase())
    if (g300Item?.descricao_embalagem) return String(g300Item.descricao_embalagem).trim()

    const consertoItem = estoqueConserto.find(r => String(r.codigo_produto).trim().toUpperCase() === prodCode.trim().toUpperCase())
    if (consertoItem?.descricao_embalagem) return String(consertoItem.descricao_embalagem).trim()

    const pedidasItem = pedidas.find(r => String(r.codigo).trim().toUpperCase() === prodCode.trim().toUpperCase())
    if (pedidasItem?.descricao_embalagem) return String(pedidasItem.descricao_embalagem).trim()

    if (embCode) {
      const base = baseCodigos.find(b => String(b["Código"]).trim().toUpperCase() === embCode.trim().toUpperCase())
      if (base?.["Descrição"]) return base["Descrição"]
    }

    return ""
  }

  const getModelo = (sku: string) => {
    const base = baseCodigos.find(b => String(b["Código"]).trim().toUpperCase() === sku.trim().toUpperCase())
    if (base?.["Grade"]) return String(base["Grade"])
    
    const g300Item = estoqueG300.find(r => String(r.codigo_produto).trim().toUpperCase() === sku.trim().toUpperCase())
    if (g300Item?.modelo_produto) return String(g300Item.modelo_produto)
    
    const pedidasItem = pedidas.find(r => String(r.codigo).trim().toUpperCase() === sku.trim().toUpperCase())
    if (pedidasItem?.modelo_produto || pedidasItem?.modelo) return String(pedidasItem.modelo_produto || pedidasItem.modelo)

    return ""
  }

  const getTipo = (sku: string, embCode: string) => {
    const ped = pedidas.find(p => String(p.codigo).trim().toUpperCase() === sku.trim().toUpperCase() && String(p.codigo_embalagem).trim().toUpperCase() === embCode.trim().toUpperCase())
    if (ped?.tipo) return String(ped.tipo).trim().toUpperCase()
    
    const desc = getEmbDesc(sku, embCode).toUpperCase()
    if (desc.includes("CALÇO") || desc.includes("CALCO") || desc.includes("ROTULO") || desc.includes("RÓTULO") || desc.includes("ETIQUETA") || embCode.startsWith("0306") || embCode.startsWith("0403")) {
      return "INSUMO"
    }
    return "EMBALAGEM"
  }

  // ─── Ordem de Pedido: lógica central com filtro inteligente ────────────────
  const ordemPedidoRows = useMemo(() => {
    // Mapa de todos os pares únicos (sku, embCode) após filtro inteligente
    // Fonte primária: linhas da relação (pedidas)
    const rowMap = new Map<string, {
      sku: string
      embCodigo: string
      embDescricao: string
      tipo: string
      tipoEmbalagem: string
      isMo: boolean
    }>()

    // 1. Coletar pares da relação (pedidas), aplicando filtro inteligente
    pedidas.filter(r => !r.isNew && r.codigo && r.codigo_embalagem).forEach(r => {
      if (!deveIncluirLinha(r)) return
      const sku = String(r.codigo || '').trim().toUpperCase()
      const emb = String(r.codigo_embalagem || '').trim().toUpperCase()
      if (!sku || !emb) return
      const key = `${sku}||${emb}`
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          sku,
          embCodigo: emb,
          embDescricao: String(r.descricao_embalagem || '').trim(),
          tipo: String(r.tipo || '').trim().toUpperCase(),
          tipoEmbalagem: String(r.tipo_embalagem || '').trim().toUpperCase(),
          isMo: ehMicroOndas(r.modelo, r.modelo_produto, sku),
        })
      }
    })

    // 2. Complementar com pares do estoque G300 e Conserto (se não existirem ainda)
    const addStockPair = (codProd: string, codEmb: string, descEmb: string) => {
      const sku = String(codProd || '').trim().toUpperCase()
      const emb = String(codEmb || '').trim().toUpperCase()
      if (!sku || !emb) return
      const key = `${sku}||${emb}`
      if (!rowMap.has(key)) {
        const pedidasItem = pedidas.find(r => String(r.codigo).trim().toUpperCase() === sku)
        const isMo = pedidasItem ? ehMicroOndas(pedidasItem.modelo, pedidasItem.modelo_produto, sku) : ehMicroOndas(undefined, undefined, sku)
        
        // Aplica o filtro inteligente: Oculta Coletivas e componentes não-superiores de MO
        const desc = normalizarTipoEmb(descEmb)
        if (desc.includes('COLETIVA')) return
        if (isMo && !desc.includes('SUPERIOR')) return

        // Só adiciona EMBALAGEM (padrão para itens sem tipo definido)
        rowMap.set(key, {
          sku,
          embCodigo: emb,
          embDescricao: descEmb,
          tipo: 'EMBALAGEM',
          tipoEmbalagem: '',
          isMo,
        })
      }
    }
    estoqueG300.filter(r => !r.isNew && r.codigo_produto && r.codigo_embalagem).forEach(r =>
      addStockPair(r.codigo_produto, r.codigo_embalagem, r.descricao_embalagem || '')
    )
    estoqueConserto.filter(r => !r.isNew && r.codigo_produto && r.codigo_embalagem).forEach(r =>
      addStockPair(r.codigo_produto, r.codigo_embalagem, r.descricao_embalagem || '')
    )

    // 3. Filtrar apenas produtos com avarias > 0 e calcular colunas
    const result = Array.from(rowMap.values())
      .filter(p => (avariasPerSku[p.sku] || 0) > 0)
      .map(p => {
        const { sku, embCodigo } = p
        const base = baseCodigos.find(b => String(b['Código']).trim().toUpperCase() === sku)
        const descricao = base?.['Descrição'] || 'Produto ' + sku
        const avarias = Math.round(avariasPerSku[sku] || 0)

        const embDescricao = p.embDescricao || getEmbDesc(sku, embCodigo)

        const estConserto = estoqueConserto
          .filter(r => !r.isNew &&
            String(r.codigo_produto).trim().toUpperCase() === sku &&
            String(r.codigo_embalagem).trim().toUpperCase() === embCodigo)
          .reduce((sum, r) => sum + Math.round(Number(r.cd) || 0), 0)

        const estG300 = estoqueG300
          .filter(r => !r.isNew &&
            String(r.codigo_produto).trim().toUpperCase() === sku &&
            String(r.codigo_embalagem).trim().toUpperCase() === embCodigo)
          .reduce((sum, r) => sum + Math.round(Number(r.cd) || 0), 0)

        const enviadoNaoChegou = pedidas
          .filter(r => !r.isNew &&
            String(r.codigo).trim().toUpperCase() === sku &&
            String(r.codigo_embalagem).trim().toUpperCase() === embCodigo &&
            (r.status || '').trim().toUpperCase() === 'FINALIZADO' &&
            deveIncluirLinha(r))
          .reduce((sum, r) => {
            const sol = String(r.solicitacao || '').trim()
            const isBa = pedidosBa.some(
              ba => String(ba.solicitacao).trim() === sol &&
                String(ba.codigo_produto).trim().toUpperCase() === sku &&
                String(ba.codigo_embalagem).trim().toUpperCase() === embCodigo
            )
            return isBa ? sum : sum + Math.round(Number(r.quantidade) || 0)
          }, 0)

        const pendenteEnvio = pedidas
          .filter(r => !r.isNew &&
            String(r.codigo).trim().toUpperCase() === sku &&
            String(r.codigo_embalagem).trim().toUpperCase() === embCodigo &&
            (r.status || '').trim().toUpperCase() !== 'FINALIZADO' &&
            deveIncluirLinha(r))
          .reduce((sum, r) => {
            const sol = String(r.solicitacao || '').trim()
            const isBa = pedidosBa.some(
              ba => String(ba.solicitacao).trim() === sol &&
                String(ba.codigo_produto).trim().toUpperCase() === sku &&
                String(ba.codigo_embalagem).trim().toUpperCase() === embCodigo
            )
            return isBa ? sum : sum + Math.round(Number(r.quantidade) || 0)
          }, 0)

        const totalCoberto = estConserto + estG300 + enviadoNaoChegou + pendenteEnvio
        const qtdParaPedido = Math.max(0, avarias - totalCoberto)

        return {
          sku,
          descricao,
          avarias,
          embCodigo,
          embDescricao,
          tipo: p.tipo,
          tipoEmbalagem: p.tipoEmbalagem,
          isMo: p.isMo,
          estoqueConserto: estConserto,
          estoqueG300: estG300,
          enviadoNaoChegou,
          pendenteEnvio,
          qtdParaPedido,
        }
      })

    // 3.5. Limpar linhas "fantasmas" (redundantes sem cobertura) para produtos Não-MO
    // Se um produto não-MO tiver múltiplas linhas, escondemos aquelas que não têm nenhuma cobertura
    const finalResult: typeof result = []
    const skus = Array.from(new Set(result.map(r => r.sku)))
    
    skus.forEach(sku => {
      const rows = result.filter(r => r.sku === sku)
      if (rows.length === 1 || rows[0].isMo) {
        // Se só tem 1 linha, ou é MO (kit com múltiplos componentes), mantém todas
        finalResult.push(...rows)
      } else {
        // Tem múltiplas linhas. Quais têm alguma cobertura (estoque ou pedidos)?
        const rowsWithCoverage = rows.filter(r => (r.estoqueConserto + r.estoqueG300 + r.enviadoNaoChegou + r.pendenteEnvio) > 0)
        
        if (rowsWithCoverage.length > 0) {
          finalResult.push(...rowsWithCoverage)
        } else {
          // Se NENHUMA tem cobertura, mantém apenas a primeira (para o produto não sumir)
          finalResult.push(rows[0])
        }
      }
    })

    // 4. Ordenar: SKU primeiro, dentro do mesmo SKU por código de embalagem
    finalResult.sort((a, b) => {
      const skuCmp = a.sku.localeCompare(b.sku)
      if (skuCmp !== 0) return skuCmp
      return a.embCodigo.localeCompare(b.embCodigo)
    })

    return finalResult
  }, [baseCodigos, avariasPerSku, estoqueG300, estoqueConserto, pedidas, pedidosBa])

  const filteredOrdemPedidoRows = useMemo(() => {
    if (!search) return ordemPedidoRows
    const t = search.toLowerCase()
    return ordemPedidoRows.filter(r =>
      r.sku.toLowerCase().includes(t) ||
      r.descricao.toLowerCase().includes(t) ||
      r.embCodigo.toLowerCase().includes(t) ||
      r.embDescricao.toLowerCase().includes(t) ||
      r.tipo.toLowerCase().includes(t) ||
      r.tipoEmbalagem.toLowerCase().includes(t)
    )
  }, [ordemPedidoRows, search])

  const exportOrdemPedidoToExcel = () => {
    const dataToExport = ordemPedidoRows.map(r => ({
      "Produto": r.sku,
      "Descrição breve do produto": r.descricao,
      "30.07 (Avarias)": r.avarias,
      "CÓDIGO EMBALAGEM": r.embCodigo,
      "DESCRIÇÃO DA EMBALAGEM": r.embDescricao,
      "TIPO": r.tipo,
      "TIPO EMBALAGEM": r.tipoEmbalagem,
      "IS MICRO-ONDAS": r.isMo ? 'SIM' : 'NÃO',
      "ESTOQUE CONSERTO": r.estoqueConserto,
      "ESTOQUE G300": r.estoqueG300,
      "ENVIADO MAS NÃO CHEGOU AINDA": r.enviadoNaoChegou,
      "PENDENTE DE ENVIO": r.pendenteEnvio,
      "QTD PARA PEDIDO": r.qtdParaPedido,
    }))

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Ordem de Pedido")
    XLSX.writeFile(wb, "Ordem_de_Pedido.xlsx")
  }

  const allSkuRows = useMemo<SkuRow[]>(() => {
    const skusSet = new Set<string>()
    baseCodigos.forEach(b => { const c = String(b["Código"] || "").trim().toUpperCase(); if (c) skusSet.add(c) })
    ;[avariasPerSku, atuaisPerSku, consertoPerSku, pedidasPerSku, chegandoPerSku].forEach(m => Object.keys(m).forEach(k => skusSet.add(k)))

    return Array.from(skusSet).map(code => {
      const base = baseCodigos.find(b => String(b["Código"]).trim().toUpperCase() === code)
      const avarias = Math.round(avariasPerSku[code] || 0)
      const estoque = Math.round(atuaisPerSku[code] || 0) + Math.round(consertoPerSku[code] || 0)
      const p = Math.round(pedidasPerSku[code] || 0)
      const c = Math.round(chegandoPerSku[code] || 0)
      const totalCoberto = estoque + p + c
      const deficit = Math.max(0, avarias - totalCoberto)
      const saldo = totalCoberto - avarias
      const pctCoberto = avarias > 0 ? Math.min(100, Math.round((totalCoberto / avarias) * 100)) : (totalCoberto > 0 ? 100 : 0)
      return { codigo: code, descricao: base?.["Descrição"] || code, avarias, estoque, pedidas: p, chegando: c, totalCoberto, deficit, saldo, pctCoberto }
    })
  }, [baseCodigos, avariasPerSku, atuaisPerSku, consertoPerSku, pedidasPerSku, chegandoPerSku])

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
  const totalCd = useMemo(() => Object.values(atuaisPerSku).reduce((a, c) => a + c, 0), [atuaisPerSku])
  const totalConserto = useMemo(() => Object.values(consertoPerSku).reduce((a, c) => a + c, 0), [consertoPerSku])
  const totalEstoque = useMemo(() => totalCd + totalConserto, [totalCd, totalConserto])
  const totalPedidas = useMemo(() => Object.values(pedidasPerSku).reduce((a, c) => a + c, 0), [pedidasPerSku])
  const totalChegando = useMemo(() => Object.values(chegandoPerSku).reduce((a, c) => a + c, 0), [chegandoPerSku])
  const totalDeficit = useMemo(() => filteredSkuRows.reduce((a, s) => a + s.deficit, 0), [filteredSkuRows])
  const globalPct = totalAvarias > 0 ? Math.min(100, Math.round(((totalEstoque + totalPedidas + totalChegando) / totalAvarias) * 100)) : 0

  // ─── Spreadsheet helpers ───────────────────────────────────────────────────
  const activeList = useMemo(() => {
    if (subTab === "estoque_g300") {
      if (!search) return estoqueG300
      const t = search.toLowerCase()
      return estoqueG300.filter(r =>
        (r.codigo_embalagem || "").toLowerCase().includes(t) ||
        (r.descricao_embalagem || "").toLowerCase().includes(t) ||
        (r.codigo_produto || "").toLowerCase().includes(t) ||
        (r.modelo_produto || "").toLowerCase().includes(t) ||
        (r.status || "").toLowerCase().includes(t)
      )
    }
    if (subTab === "conserto") {
      if (!search) return estoqueConserto
      const t = search.toLowerCase()
      return estoqueConserto.filter(r =>
        (r.codigo_embalagem || "").toLowerCase().includes(t) ||
        (r.descricao_embalagem || "").toLowerCase().includes(t) ||
        (r.codigo_produto || "").toLowerCase().includes(t) ||
        (r.modelo_produto || "").toLowerCase().includes(t) ||
        (r.status || "").toLowerCase().includes(t)
      )
    }
    const list = subTab === "pedidas" ? pedidas : subTab === "atuais" ? atuais : chegando
    if (!search) return list
    const t = search.toLowerCase()
    return list.filter(r => r.codigo.toLowerCase().includes(t) || (baseCodigos.find(b => b["Código"].toUpperCase() === r.codigo.toUpperCase())?.["Descrição"] || "").toLowerCase().includes(t))
  }, [subTab, pedidas, atuais, chegando, estoqueG300, estoqueConserto, search, baseCodigos])

  const hasUnsaved = useMemo(() => {
    if (subTab === "estoque_g300") return estoqueG300.some(r => r.isDirty)
    if (subTab === "conserto") return estoqueConserto.some(r => r.isDirty)
    if (subTab === "pedidas") return pedidas.some(r => r.isDirty)
    if (subTab === "atuais") return atuais.some(r => r.isDirty)
    if (subTab === "chegando") return chegando.some(r => r.isDirty)
    return false
  }, [subTab, pedidas, atuais, chegando, estoqueG300, estoqueConserto])

  const cellSkus = useMemo(() => {
    if (!skuSearchCell) return baseCodigos.slice(0, 8)
    const t = skuSearchCell.toLowerCase()
    return baseCodigos.filter(b => b["Código"].toLowerCase().includes(t) || b["Descrição"].toLowerCase().includes(t)).slice(0, 8)
  }, [baseCodigos, skuSearchCell])

  const exportarEstoqueG300 = () => {
    const data = subTab === "estoque_g300" ? estoqueG300 : estoqueConserto
    if (!data.length) { alert('Nenhum dado para exportar.'); return }
    let csv = '\uFEFFCód. Embalagem;Descrição Embalagem;Cód. Produto;Modelo Produto;CD;Status\n'
    data.forEach((r: any) => {
      csv += `"${r.codigo_embalagem || ''}";"${(r.descricao_embalagem || '').replace(/"/g, '""')}";"${r.codigo_produto || ''}";"${(r.modelo_produto || '').replace(/"/g, '""')}";${r.cd ?? 0};"${r.status || ''}"\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `estoque_g300_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const addRow = () => {
    if (!user) { alert("Faça login para adicionar lançamentos."); return }
    const today = new Date().toISOString().split("T")[0]
    if (subTab === "estoque_g300" || subTab === "conserto") {
      const row = { codigo_embalagem: "", descricao_embalagem: "", codigo_produto: "", modelo_produto: "", cd: 0, status: "", isNew: true, isDirty: true }
      if (subTab === "estoque_g300") setEstoqueG300([row, ...estoqueG300])
      else setEstoqueConserto([row, ...estoqueConserto])
    } else {
      const row: EmbalagemRegistro = { codigo: "", quantidade: null, isNew: true, isDirty: true }
      if (subTab === "pedidas") { row.data = today; setPedidas([row, ...pedidas]) }
      else if (subTab === "atuais") { row.chegada = today; setAtuais([row, ...atuais]) }
      else if (subTab === "chegando") { row.data = today; setChegando([row, ...chegando]) }
    }
  }

  const updateRow = (idx: number, field: string, value: any) => {
    if (subTab === "estoque_g300") {
      const u = [...estoqueG300]; u[idx] = { ...u[idx], [field]: value, isDirty: true }; setEstoqueG300(u)
    } else if (subTab === "conserto") {
      const u = [...estoqueConserto]; u[idx] = { ...u[idx], [field]: value, isDirty: true }; setEstoqueConserto(u)
    } else {
      const fieldKey = field as keyof EmbalagemRegistro
      if (subTab === "pedidas") { const u = [...pedidas]; u[idx] = { ...u[idx], [fieldKey]: value, isDirty: true }; setPedidas(u) }
      else if (subTab === "atuais") { const u = [...atuais]; u[idx] = { ...u[idx], [fieldKey]: value, isDirty: true }; setAtuais(u) }
      else if (subTab === "chegando") { const u = [...chegando]; u[idx] = { ...u[idx], [fieldKey]: value, isDirty: true }; setChegando(u) }
    }
  }

  const removeRow = (idx: number) => {
    if (subTab === "estoque_g300") setEstoqueG300(estoqueG300.filter((_, i) => i !== idx))
    else if (subTab === "conserto") setEstoqueConserto(estoqueConserto.filter((_, i) => i !== idx))
    else if (subTab === "pedidas") setPedidas(pedidas.filter((_, i) => i !== idx))
    else if (subTab === "atuais") setAtuais(atuais.filter((_, i) => i !== idx))
    else if (subTab === "chegando") setChegando(chegando.filter((_, i) => i !== idx))
  }

  const saveRows = async () => {
    const listMap = { 
      pedidas: { list: pedidas, table: "embalagens_pedidas" }, 
      atuais: { list: atuais, table: "embalagens_atuais" }, 
      chegando: { list: chegando, table: "embalagens_chegando" },
      estoque_g300: { list: estoqueG300, table: "estoque_g300" },
      conserto: { list: estoqueConserto, table: "estoque_conserto" }
    }
    const { list, table } = listMap[subTab as keyof typeof listMap]
    const dirty = list.filter(r => r.isDirty)
    if (!dirty.length) return

    if (subTab === "estoque_g300" || subTab === "conserto") {
      if (dirty.some(r => !r.codigo_embalagem || !r.codigo_produto)) {
        alert("Preencha o código da embalagem e do produto em todas as linhas."); return
      }
    } else {
      if (dirty.some(r => !r.codigo || !r.quantidade || Number(r.quantidade) <= 0)) {
        alert("Preencha o SKU e quantidade > 0 em todas as linhas."); return
      }
    }

    setSaving(true)
    try {
      for (const row of dirty) {
        if (subTab === "estoque_g300" || subTab === "conserto") {
          const payload = {
            codigo_embalagem: row.codigo_embalagem.trim().toUpperCase(),
            descricao_embalagem: (row.descricao_embalagem || '').trim(),
            codigo_produto: row.codigo_produto.trim().toUpperCase(),
            modelo_produto: (row.modelo_produto || '').trim(),
            cd: Math.round(Number(row.cd) || 0),
            status: (row.status || '').trim()
          }
          if (row.isNew) {
            const { error } = await supabase.from(table).insert([payload])
            if (error) throw error
          } else {
            const { error } = await supabase.from(table).update(payload).eq("id", row.id)
            if (error) throw error
          }
        } else {
          const payload: any = { codigo: row.codigo.trim().toUpperCase(), quantidade: Number(row.quantidade) }
          payload[subTab === "atuais" ? "chegada" : "data"] = subTab === "atuais" ? row.chegada : row.data
          if (row.isNew) { const { error } = await supabase.from(table).insert([payload]); if (error) throw error }
        }
      }
      alert("Lançamentos salvos!")
      fetchData()
    } catch (err: any) {
      alert("Erro: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteRecord = async (table: "embalagens_atuais" | "embalagens_pedidas" | "embalagens_chegando" | "estoque_g300" | "estoque_conserto", id: number) => {
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
    { label: "Chegando", value: totalChegando, color: "#f97316" },
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
          { id: "pedidas", label: "CRONOGRAMA", icon: ShoppingCart },
          { id: "ordem_pedido", label: "ORDEM DE PEDIDO", icon: FileText },
          { id: "estoque_g300", label: "ESTOQUE G300", icon: Boxes },
          { id: "conserto", label: "CONSERTO", icon: Wrench },
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

        {subTab === "pedidas" && (
          <div className="ml-auto">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all cursor-pointer shadow-inner"
            >
              <RefreshCw size={13} className="text-blue-400" /> Atualizar Relação
            </button>
          </div>
        )}

        {subTab === "estoque_g300" && user && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={exportarEstoqueG300}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all cursor-pointer"
              title="Exportar Excel"
            >
              <FileText size={13} className="text-emerald-400" /> Exportar Excel
            </button>
            <button
              onClick={() => { setShowAddG300Modal(true); setAddG300Search(''); setSelectedBaItems(new Set()) }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all cursor-pointer"
            >
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
        {subTab === "conserto" && user && (
          <div className="ml-auto flex gap-2">
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
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> CD: <span className="text-white font-bold">{totalCd.toLocaleString("pt-BR")}</span></span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> CONSERTO: <span className="text-white font-bold">{totalConserto.toLocaleString("pt-BR")}</span></span>
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
                            return <path key={i} d={path} fill="none" stroke={arc.color} strokeWidth={22} />
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
                          { label: "A caminho", value: totalChegando, color: "#f97316" },
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
                            return <path key={i} d={path} fill="none" stroke={arc.color} strokeWidth={22} />
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
                        {(() => {
                          const realPedidas = pedidas.filter(r => !r.isNew)
                          const groups: Record<string, EmbalagemRegistro[]> = {}
                          realPedidas.forEach(p => {
                            const key = p.solicitacao || 'sem-solicitacao'
                            if (!groups[key]) groups[key] = []
                            groups[key].push(p)
                          })

                          const sortedGroups = Object.entries(groups).sort((a, b) => {
                            const dateA = a[1][0]?.data_solicitacao || a[1][0]?.data || ''
                            const dateB = b[1][0]?.data_solicitacao || b[1][0]?.data || ''
                            if (dateA !== dateB) return dateB.localeCompare(dateA)
                            const numA = Number(a[0].replace(/\D/g, '')) || 0
                            const numB = Number(b[0].replace(/\D/g, '')) || 0
                            return numB - numA
                          })

                          return sortedGroups.slice(0, 5).map(([solKey, items], i) => {
                            let totSolic = 0, totEnviado = 0, totPendente = 0
                            items.forEach(p => {
                              totSolic += Math.round(Number(p.quantidade) || 0)
                              totEnviado += Math.round(Number(p.enviado) || 0)
                              totPendente += Math.round(Number(p.pendente) || 0)
                            })

                            const dateLabel = items[0]?.data_solicitacao
                              ? new Date(items[0].data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR')
                              : items[0]?.data
                                ? new Date(items[0].data + 'T00:00:00').toLocaleDateString('pt-BR')
                                : '—'

                            const previsao = items[0]?.previsao_entrega || items[0]?.entrega_compras || 'TBC'

                            const status = totPendente === 0 
                              ? "FINALIZADO" 
                              : totEnviado > 0 
                                ? "EM ANDAMENTO" 
                                : "PENDENTE"

                            const statusCls = status === "FINALIZADO"
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              : status === "EM ANDAMENTO"
                                ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                                : "text-amber-500 bg-amber-500/10 border-amber-500/20"

                            return (
                              <tr key={solKey} className={cn("hover:bg-slate-700/20 transition-colors", i % 2 === 0 ? "bg-transparent" : "bg-slate-800/20")}>
                                <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-slate-400">
                                  {solKey === 'sem-solicitacao' ? 'S/N' : solKey}
                                </td>
                                <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-slate-400">
                                  {dateLabel}
                                </td>
                                <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-blue-400 text-center">{totSolic.toLocaleString("pt-BR")}</td>
                                <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-emerald-400 text-center">{totEnviado.toLocaleString("pt-BR")}</td>
                                <td className={cn("px-5 py-3.5 font-mono text-[11px] font-normal text-center", totPendente > 0 ? "text-amber-500" : "text-slate-500")}>
                                  {totPendente.toLocaleString("pt-BR")}
                                </td>
                                <td className="px-5 py-3.5 font-mono text-[11px] font-normal text-slate-400 text-center">{previsao}</td>
                                <td className="px-5 py-3.5 text-center">
                                  <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wider border", statusCls)}>
                                    {status}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        })()}
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
          /* ─── PEDIDOS ACCORDION VIEW ─── */
          subTab === "pedidas" ? (
          <motion.div key="pedidos-accordion" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-2">
            {/* Accordion header */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <div className="grid grid-cols-[2fr_1.5fr_1.5fr_4fr_1fr_1fr_1fr] px-5 py-3 border-b border-slate-800 bg-[#0f172a]/60 text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wider">
                <span>Solicitação</span>
                <span>Data Solicitação</span>
                <span>Solicitante</span>
                <span>Resumo Operacional (Responsável / Status)</span>
                <span className="text-right">Solicitado</span>
                <span className="text-right">Enviado</span>
                <span className="text-right text-amber-400">Pendente</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 className="animate-spin text-blue-500 mr-2" size={18} />
                  <span className="text-xs font-mono">Carregando...</span>
                </div>
              ) : (() => {
                // Group pedidas by solicitation key
                const realPedidas = pedidas.filter(r => {
                  if (r.isNew) return false
                  if (search) {
                    const t = search.toLowerCase()
                    return (
                      (r.solicitacao || '').toLowerCase().includes(t) ||
                      (r.solicitante || '').toLowerCase().includes(t) ||
                      (r.codigo || '').toLowerCase().includes(t) ||
                      (r.codigo_embalagem || '').toLowerCase().includes(t) ||
                      (r.status || '').toLowerCase().includes(t) ||
                      (r.responsabilidade || '').toLowerCase().includes(t)
                    )
                  }
                  return true
                })
                if (realPedidas.length === 0) return (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                    <Inbox size={24} className="mb-2" />
                    <p className="text-xs font-mono">{search ? `Nenhum resultado para "${search}".` : "Nenhuma solicitação encontrada."}</p>
                  </div>
                )

                const groups: Record<string, EmbalagemRegistro[]> = {}
                realPedidas.forEach(p => {
                  const key = p.solicitacao || 'sem-solicitacao'
                  if (!groups[key]) groups[key] = []
                  groups[key].push(p)
                })

                const sortedGroups = Object.entries(groups).sort((a, b) => {
                  const numA = Number(a[0].replace(/\D/g, '')) || 0
                  const numB = Number(b[0].replace(/\D/g, '')) || 0
                  return numB - numA // Descending
                })

                return sortedGroups.map(([solKey, items], gi) => {
                  const isExpanded = expandedSolicitations.has(solKey)
                  const toggle = () => setExpandedSolicitations(prev => {
                    const next = new Set(prev)
                    if (next.has(solKey)) next.delete(solKey)
                    else next.add(solKey)
                    return next
                  })

                  // Compute totals
                  let totSolic = 0, totEnviado = 0, totPendente = 0
                  const rowDetails = items.map(p => {
                    const sku = String(p.codigo || '').trim().toUpperCase()
                    const qty = Math.round(Number(p.quantidade) || 0)
                    const enviado = Math.round(Number(p.enviado) || 0)
                    const pendente = Math.round(Number(p.pendente) || 0)
                    totSolic += qty; totEnviado += enviado; totPendente += pendente
                    
                    const status = String(p.status || 'PENDENTE').toUpperCase()
                    const statusCls = status === 'FINALIZADO'
                      ? 'text-emerald-400'
                      : status === 'EM ANDAMENTO'
                        ? 'text-blue-400'
                        : 'text-amber-400'

                    const sol = String(p.solicitacao || '').trim()
                    const prod = String(p.codigo || '').trim().toUpperCase()
                    const emb = String(p.codigo_embalagem || '').trim().toUpperCase()
                    const rowId = String(p.id || '')
                    const isBa = pedidosBa.some(
                      ba => {
                        // Se o registro BA tem row_id, usar para match preciso (evita confundir linhas duplicadas)
                        if (ba.row_id && rowId) {
                          return String(ba.row_id) === rowId;
                        }
                        return String(ba.solicitacao).trim() === sol &&
                               String(ba.codigo_produto).trim().toUpperCase() === prod &&
                               String(ba.codigo_embalagem).trim().toUpperCase() === emb;
                      }
                    )

                    return { p, sku, qty, enviado, pendente, status, statusCls, isBa, rowId }
                  })

                  const dateLabel = items[0]?.data_solicitacao
                    ? new Date(items[0].data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR')
                    : items[0]?.data
                      ? new Date(items[0].data + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '—'

                  const responsavel = items[0]?.responsabilidade || 'Não definido'
                  const statusResumo = totPendente > 0
                    ? `Pendente (${totPendente.toLocaleString('pt-BR')} un)`
                    : 'Concluído'

                  return (
                    <div key={solKey} className="border-b border-slate-800/60 last:border-0">
                      {/* Summary row */}
                      <button
                        onClick={toggle}
                        className="w-full grid grid-cols-[2fr_1.5fr_1.5fr_4fr_1fr_1fr_1fr] px-5 py-3.5 hover:bg-slate-800/20 transition-colors text-left items-center cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className={cn("text-slate-400 transition-transform duration-200", isExpanded ? "rotate-0" : "-rotate-90")}>
                            <ChevronRight size={14} className={cn("transition-transform duration-200", isExpanded ? "rotate-90" : "")} />
                          </span>
                          <span className="font-mono text-[11px] font-medium text-white uppercase tracking-wider">
                            SOLICITAÇÃO {solKey === 'sem-solicitacao' ? 'S/N' : solKey}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-[11px] font-normal text-slate-400">
                          <span className="text-slate-600">⧉</span>
                          {dateLabel}
                        </span>
                        <span className="font-mono text-[11px] font-normal text-slate-300 truncate">
                          {items[0]?.solicitante || '—'}
                        </span>
                        <span className="flex items-center gap-3 font-mono text-[11px] font-normal text-slate-300">
                          <span className="text-slate-400">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                          <span className="text-slate-700">•</span>
                          <span>👤 {responsavel}</span>
                          <span className="text-slate-700">•</span>
                          <span className={cn(totPendente > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                            {totPendente > 0 ? `⏳ ${statusResumo}` : '✓ Concluído'}
                          </span>
                        </span>
                        <span className="font-mono text-[11px] font-normal text-white text-right">{totSolic.toLocaleString('pt-BR')}</span>
                        <span className="font-mono text-[11px] font-normal text-emerald-400 text-right">{totEnviado.toLocaleString('pt-BR')}</span>
                        <span className={cn("font-mono text-[11px] font-normal text-right", totPendente > 0 ? 'text-amber-400' : 'text-slate-500')}>{totPendente.toLocaleString('pt-BR')}</span>
                      </button>

                      {/* Expanded detail rows */}
                      {isExpanded && (
                        <div className="bg-slate-950/40 border-t border-slate-800/50 overflow-x-auto">
                          <table className="w-full border-collapse text-[10px] font-mono" style={{ minWidth: '1400px', tableLayout: 'fixed' }}>
                            <colgroup>
                              <col style={{ width: '88px' }} />
                              <col style={{ width: '110px' }} />
                              <col style={{ width: '52px' }} />
                              <col style={{ width: '120px' }} />
                              <col style={{ width: '180px' }} />
                              <col style={{ width: '80px' }} />
                              <col style={{ width: '110px' }} />
                              <col style={{ width: '68px' }} />
                              <col style={{ width: '68px' }} />
                              <col style={{ width: '100px' }} />
                              <col style={{ width: '100px' }} />
                              <col style={{ width: '95px' }} />
                              <col style={{ width: '95px' }} />
                              <col style={{ width: '68px' }} />
                              <col style={{ width: '80px' }} />
                            </colgroup>
                            <thead>
                              <tr className="border-b border-slate-800/60 bg-slate-950/20">
                                <th className="px-3 py-2 text-left text-[9px] font-normal text-slate-500 uppercase tracking-wider">Cód. Produto</th>
                                <th className="px-3 py-2 text-left text-[9px] font-normal text-slate-500 uppercase tracking-wider">Modelo</th>
                                <th className="px-3 py-2 text-center text-[9px] font-normal text-slate-500 uppercase tracking-wider">Qtd</th>
                                <th className="px-3 py-2 text-left text-[9px] font-normal text-slate-500 uppercase tracking-wider">Cód. Emb.</th>
                                <th className="px-3 py-2 text-left text-[9px] font-normal text-slate-500 uppercase tracking-wider">Descrição Emb.</th>
                                <th className="px-3 py-2 text-left text-[9px] font-normal text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-3 py-2 text-left text-[9px] font-normal text-slate-500 uppercase tracking-wider">Tipo Emb.</th>
                                <th className="px-3 py-2 text-center text-[9px] font-normal text-emerald-500/80 uppercase tracking-wider">Enviado</th>
                                <th className="px-3 py-2 text-center text-[9px] font-normal text-orange-400/80 uppercase tracking-wider">Pendente</th>
                                <th className="px-3 py-2 text-center text-[9px] font-normal text-slate-500 uppercase tracking-wider">Entrega (C.)</th>
                                <th className="px-3 py-2 text-center text-[9px] font-normal text-slate-500 uppercase tracking-wider">Envio (E.)</th>
                                <th className="px-3 py-2 text-center text-[9px] font-normal text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-3 py-2 text-center text-[9px] font-normal text-emerald-400/90 uppercase tracking-wider">Status BA</th>
                                <th className="px-3 py-2 text-center text-[9px] font-normal text-slate-500 uppercase tracking-wider">NF</th>
                                <th className="px-3 py-2 text-center text-[9px] font-normal text-slate-500 uppercase tracking-wider">Previsão</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rowDetails.map((row, ri) => (
                                <tr key={ri} className={cn(
                                  "border-b border-slate-800/30 last:border-0 transition-colors hover:bg-slate-800/10 font-normal",
                                  ri % 2 === 1 ? "bg-slate-800/10" : ""
                                )}>
                                  <td className="px-3 py-2.5 overflow-hidden">
                                    <span className="block truncate text-slate-300 font-normal cursor-help" title={row.p.modelo_produto || row.p.modelo || ''}>{row.sku}</span>
                                  </td>
                                  <td className="px-3 py-2.5 overflow-hidden">
                                    <span className="block truncate text-slate-400 font-normal" title={row.p.modelo || ''}>{row.p.modelo || '—'}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-slate-300 font-normal">{row.qty.toLocaleString('pt-BR')}</td>
                                  <td className="px-3 py-2.5 overflow-hidden">
                                    <span className="block truncate text-slate-500 font-normal" title={row.p.codigo_embalagem || ''}>{row.p.codigo_embalagem || '—'}</span>
                                  </td>
                                  <td className="px-3 py-2.5 overflow-hidden">
                                    <span className="block truncate text-slate-400 font-normal" title={row.p.descricao_embalagem || ''}>{row.p.descricao_embalagem || '—'}</span>
                                  </td>
                                  <td className="px-3 py-2.5 overflow-hidden">
                                    <span className="block truncate text-slate-400 font-normal uppercase">{row.p.tipo || '—'}</span>
                                  </td>
                                  <td className="px-3 py-2.5 overflow-hidden">
                                    <span className="block truncate text-slate-400 font-normal uppercase">{row.p.tipo_embalagem || '—'}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-emerald-400/90 font-normal">{row.enviado.toLocaleString('pt-BR')}</td>
                                  <td className={cn("px-3 py-2.5 text-center font-normal", row.pendente > 0 ? 'text-orange-400' : 'text-slate-600')}>{row.pendente.toLocaleString('pt-BR')}</td>
                                  <td className="px-3 py-2.5 text-center text-slate-400 font-normal text-[9px]">{row.p.entrega_compras || 'TBC'}</td>
                                  <td className="px-3 py-2.5 text-center text-slate-400 font-normal text-[9px]">{row.p.envio_expedicao || 'TBC'}</td>
                                  <td className="px-3 py-2.5 text-center text-[9px] font-normal uppercase tracking-wider">
                                    <span className={cn(row.statusCls, "font-normal")}>{row.status}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-[9px] font-normal">
                                    <button
                                      disabled={togglingBa}
                                      onClick={() => toggleBaixado(
                                        row.p.solicitacao || '',
                                        row.sku,
                                        row.p.codigo_embalagem || '',
                                        row.rowId
                                      )}
                                      title={row.isBa ? "Clique para desmarcar BA" : "Clique para marcar como chegou (BA)"}
                                      className={cn(
                                        "px-2.5 py-0.5 rounded-md font-semibold transition-all text-[9px] border leading-relaxed",
                                        togglingBa ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                                        row.isBa
                                          ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
                                          : "bg-slate-900/60 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                                      )}
                                    >
                                      {row.isBa ? "✓ BA" : "—"}
                                    </button>
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-slate-400 font-normal text-[9px]">{row.p.nf || '—'}</td>
                                  <td className="px-3 py-2.5 text-center text-slate-400 font-normal text-[9px]">{row.p.previsao_entrega || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </motion.div>
          ) : subTab === "ordem_pedido" ? (
          /* ─── ORDEM DE PEDIDO VIEW ─── */
          <motion.div key="ordem-pedido" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-2">
            <div className="bg-[#111827] border border-slate-800/80 rounded-2xl overflow-hidden shadow-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0f172a]/50">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Ordem de Pedido</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Calculado automaticamente — somente leitura. Produtos MO exibem todos os insumos individuais do kit.</p>
                </div>
                <button
                  onClick={exportOrdemPedidoToExcel}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all cursor-pointer"
                >
                  <FileText size={13} /> Exportar Excel
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1400px] font-sans">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#0f172a]/30">
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider w-[90px]">Produto</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider w-[190px]">Descrição breve do produto</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center w-[60px]">30.07</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider w-[150px]">Código Embalagem</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider w-[210px]">Descrição da Embalagem</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider w-[72px]">Tipo</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider w-[90px]">Tipo Emb.</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center w-[100px]">Est. Conserto</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center w-[90px]">Est. G300</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center w-[100px]">Env. não chegou</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center w-[100px]">Pendente Envio</th>
                      <th className="px-4 py-3 text-[9px] font-medium text-white uppercase tracking-wider text-center w-[100px]">Qtd p/ Pedido</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#111827]">
                    {loading ? (
                      <tr>
                        <td colSpan={12} className="px-8 py-10 text-center text-slate-500">
                          <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
                          Carregando...
                        </td>
                      </tr>
                    ) : filteredOrdemPedidoRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-8 py-10 text-center text-slate-600">
                          <Inbox size={22} className="mx-auto mb-2" />
                          {search ? `Nenhum resultado para "${search}".` : "Nenhum produto com avaria registrado."}
                        </td>
                      </tr>
                    ) : (() => {
                      // Agrupamento visual: controla fundo alternado por SKU (não por linha)
                      let lastSku = ''
                      let skuGroupIdx = -1
                      return filteredOrdemPedidoRows.map((row, idx) => {
                        if (row.sku !== lastSku) {
                          lastSku = row.sku
                          skuGroupIdx++
                        }
                        const isKitMo = row.isMo
                        // Detectar primeira e última linha do grupo
                        const isFirstInGroup = idx === 0 || filteredOrdemPedidoRows[idx - 1].sku !== row.sku
                        const isLastInGroup = idx === filteredOrdemPedidoRows.length - 1 || filteredOrdemPedidoRows[idx + 1].sku !== row.sku
                        const groupBg = skuGroupIdx % 2 === 0 ? 'bg-transparent' : 'bg-slate-900/20'
                        const kitBg = isKitMo ? (skuGroupIdx % 2 === 0 ? 'bg-sky-950/10' : 'bg-sky-950/20') : groupBg

                        return (
                          <tr
                            key={`${row.sku}||${row.embCodigo}`}
                            className={cn(
                              'hover:bg-white/[0.02] transition-colors',
                              kitBg,
                              isFirstInGroup && !isLastInGroup && 'border-t border-slate-700/40',
                              isLastInGroup && !isFirstInGroup && 'border-b border-slate-700/40',
                            )}
                          >
                            {/* Produto: só mostra na primeira linha do grupo */}
                            <td className="px-4 py-2.5 font-mono text-[11px] font-semibold">
                              {isFirstInGroup ? (
                                <span className="text-white">{row.sku}</span>
                              ) : (
                                <span className="text-slate-700 select-none">↳</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[11px] text-slate-400 max-w-[190px] truncate" title={row.descricao}>
                              {isFirstInGroup ? row.descricao : ''}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-300 text-center">
                              {isFirstInGroup ? row.avarias.toLocaleString('pt-BR') : ''}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400">{row.embCodigo || '—'}</td>
                            <td className="px-4 py-2.5 text-[11px] text-slate-300 max-w-[210px] truncate" title={row.embDescricao}>{row.embDescricao || '—'}</td>
                            <td className="px-4 py-2.5 font-mono text-[10px] uppercase">
                              <span className={cn(
                                row.tipo === 'INSUMO' ? 'text-amber-400/80' : 'text-slate-400'
                              )}>{row.tipo || '—'}</span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 uppercase">{row.tipoEmbalagem || '—'}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-300 text-center">{row.estoqueConserto.toLocaleString('pt-BR')}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-300 text-center">{row.estoqueG300.toLocaleString('pt-BR')}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-center">
                              <div className={cn("flex items-center justify-center gap-1.5", row.enviadoNaoChegou > 0 ? "text-emerald-500" : "text-slate-500")}>
                                {row.enviadoNaoChegou > 0 && <Truck size={12} className="opacity-80" />}
                                <span>{row.enviadoNaoChegou.toLocaleString('pt-BR')}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-center">
                              <div className={cn("flex items-center justify-center gap-1.5", row.pendenteEnvio > 0 ? "text-amber-500" : "text-slate-500")}>
                                {row.pendenteEnvio > 0 && <Hourglass size={12} className="opacity-80" />}
                                <span>{row.pendenteEnvio.toLocaleString('pt-BR')}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[12px] text-center">
                              <span className={cn(
                                row.qtdParaPedido > 0 ? 'text-rose-500' : 'text-slate-600'
                              )}>{row.qtdParaPedido.toLocaleString('pt-BR')}</span>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
          ) : (
          /* ─── SPREADSHEET TABS (estoque_g300 / conserto / atuais / chegando) ─── */
          <motion.div key="spreadsheet" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-md"
          >
            <div className="px-6 py-4 border-b border-slate-800 bg-[#0f172a]/50">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                {subTab === "conserto" ? "Conserto" : subTab === "estoque_g300" ? "Estoque G300" : subTab === "atuais" ? "Estoque CD / Conserto" : "Cargas a Caminho"}
              </h3>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-collapse min-w-[800px] font-sans">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0f172a]/30">
                    {(subTab === "estoque_g300" || subTab === "conserto") ? (
                      <>
                        <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider w-[180px]">Cód. Embalagem</th>
                        <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider w-[240px]">Descrição Embalagem</th>
                        <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider w-[140px]">Cód. Produto</th>
                        <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">Modelo Produto</th>
                        <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider text-center w-[100px]">CD</th>
                        <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider w-[200px]">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider w-[160px]">Data</th>
                        <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider w-[220px]">SKU</th>
                        <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">Descrição</th>
                        <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider text-center w-[140px]">Quantidade</th>
                      </>
                    )}
                    <th className="px-6 py-3.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider text-right w-[80px]">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
                  {loading ? (
                    <tr>
                      <td colSpan={(subTab === "estoque_g300" || subTab === "conserto") ? 7 : 5} className="px-8 py-10 text-center text-slate-500">
                        <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
                        Carregando...
                      </td>
                    </tr>
                  ) : activeList.length === 0 ? (
                    <tr>
                      <td colSpan={(subTab === "estoque_g300" || subTab === "conserto") ? 7 : 5} className="px-8 py-10 text-center text-slate-600">
                        <Inbox size={22} className="mx-auto mb-2" />
                        Nenhum lançamento. Clique em 'Nova Linha'.
                      </td>
                    </tr>
                  ) : activeList.map((item, idx) => {
                    const base = (subTab !== "estoque_g300" && subTab !== "conserto")
                      ? baseCodigos.find(b => String(b["Código"]).trim().toUpperCase() === String(item.codigo).trim().toUpperCase())
                      : null
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
                            if (subTab === "estoque_g300" || subTab === "conserto") {
                              if (colIdx === 0) updateRow(targetIdx, "codigo_embalagem", val);
                              else if (colIdx === 1) updateRow(targetIdx, "descricao_embalagem", val);
                              else if (colIdx === 2) updateRow(targetIdx, "codigo_produto", val);
                              else if (colIdx === 3) updateRow(targetIdx, "modelo_produto", val);
                              else if (colIdx === 4) updateRow(targetIdx, "cd", Number(val.replace(/\D/g, "")) || 0);
                              else if (colIdx === 5) updateRow(targetIdx, "status", val);
                            } else {
                              if (colIdx === 0) updateRow(targetIdx, subTab === "atuais" ? "chegada" : "data", val);
                              else if (colIdx === 1) updateRow(targetIdx, "codigo", val);
                              else if (colIdx === 2) { const num = Number(val.replace(/\D/g, "")); updateRow(targetIdx, "quantidade", isNaN(num) ? null : num); }
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
                        {(subTab === "estoque_g300" || subTab === "conserto") ? (
                          <>
                            <td className="p-0 border-r border-white/5">
                              <input type="text" value={item.codigo_embalagem || ''}
                                onChange={e => updateRow(idx, "codigo_embalagem", e.target.value)}
                                onPaste={e => handleSmartPaste(e, 0)}
                                placeholder="Cód. Embalagem..."
                                className="w-full bg-transparent border-none px-6 py-3 text-[11px] text-white font-mono font-normal focus:bg-slate-900/60 focus:outline-none uppercase" />
                            </td>
                            <td className="p-0 border-r border-white/5">
                              <input type="text" value={item.descricao_embalagem || ''}
                                onChange={e => updateRow(idx, "descricao_embalagem", e.target.value)}
                                onPaste={e => handleSmartPaste(e, 1)}
                                placeholder="Descrição..."
                                className="w-full bg-transparent border-none px-6 py-3 text-[11px] text-slate-300 font-mono font-normal focus:bg-slate-900/60 focus:outline-none" />
                            </td>
                            <td className="p-0 border-r border-white/5">
                              <input type="text" value={item.codigo_produto || ''}
                                onChange={e => updateRow(idx, "codigo_produto", e.target.value)}
                                onPaste={e => handleSmartPaste(e, 2)}
                                placeholder="Cód. Produto..."
                                className="w-full bg-transparent border-none px-6 py-3 text-[11px] text-white font-mono font-normal focus:bg-slate-900/60 focus:outline-none uppercase" />
                            </td>
                            <td className="p-0 border-r border-white/5">
                              <input type="text" value={item.modelo_produto || ''}
                                onChange={e => updateRow(idx, "modelo_produto", e.target.value)}
                                onPaste={e => handleSmartPaste(e, 3)}
                                placeholder="Modelo..."
                                className="w-full bg-transparent border-none px-6 py-3 text-[11px] text-slate-300 font-mono font-normal focus:bg-slate-900/60 focus:outline-none" />
                            </td>
                            <td className="p-0 border-r border-white/5 text-center">
                              <input type="text" value={item.cd ?? ''}
                                onChange={e => updateRow(idx, "cd", e.target.value === '' ? 0 : Number(e.target.value.replace(/\D/g, '')))}
                                onPaste={e => handleSmartPaste(e, 4)}
                                placeholder="0"
                                className="w-full bg-transparent border-none py-3 text-center text-[11px] text-white font-mono font-normal focus:bg-slate-900/60 focus:outline-none" />
                            </td>
                            <td className="p-0 border-r border-white/5">
                              <input type="text" value={item.status || ''}
                                onChange={e => updateRow(idx, "status", e.target.value)}
                                onPaste={e => handleSmartPaste(e, 5)}
                                placeholder="Status..."
                                className="w-full bg-transparent border-none px-6 py-3 text-[11px] text-slate-300 font-mono font-normal focus:bg-slate-900/60 focus:outline-none" />
                            </td>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}

                        {/* Action Cell */}
                        <td className="px-6 py-2 text-right">
                          {item.isNew ? (
                            <button onClick={() => removeRow(idx)} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer" title="Cancelar">
                              <X size={13} />
                            </button>
                          ) : (
                            user && (
                              <button onClick={() => deleteRecord(
                                subTab === "conserto" ? "estoque_conserto"
                                  : subTab === "estoque_g300" ? "estoque_g300"
                                  : subTab === "atuais" ? "embalagens_atuais" : "embalagens_chegando",
                                item.id!
                              )}
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
        )
      )}
      </AnimatePresence>

      {/* ─── IMPORT MODAL ─── */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowImportModal(false); setImportedFileName(""); setParsedRows([]); setSelectedSolicitantes([]); }}
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
                <button onClick={() => { setShowImportModal(false); setImportedFileName(""); setParsedRows([]); setSelectedSolicitantes([]); }} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col flex-1 min-h-0 gap-6 font-sans">
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                    {subTab === "pedidas" ? (
                      <>
                        Carregue a planilha Excel de Compras com as colunas na ordem esperada:<br />
                        <span className="font-mono text-[9px] text-slate-500 font-normal uppercase tracking-wider block bg-slate-950 p-2 rounded-xl mt-1 overflow-x-auto whitespace-nowrap">
                          SOLICITAÇÃO | DATA | SOLICITANTE | DESTINO | CÓD. EMBALAGEM | DESCRIÇÃO | TIPO | TIPO EMB. | CÓD. PRODUTO | MODELO PROD. | MODELO | SOLICITADO | ENVIADO | PENDENTE | ENTREGA | ENVIO | STATUS | COM. TATIANA | COMENTÁRIO | RESPONSABILIDADE | NF | PLACA | PREVISÃO
                        </span>
                      </>
                    ) : (
                      <>
                        Carregue a planilha Excel ou Sheets com as colunas na ordem esperada:<br />
                        <span className="font-bold text-white uppercase tracking-wider">DATA | CÓDIGO | QUANTIDADE</span>.
                      </>
                    )}
                  </p>

                  {/* Drag and Drop Excel Area */}
                  <div className="border border-dashed border-white/10 rounded-2xl p-5 bg-white/[0.01] hover:bg-white/[0.02] transition-all flex flex-col items-center justify-center gap-2.5 relative cursor-pointer group">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.tsv,.csv,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleExcelUpload(file);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <FileText className="text-blue-400 group-hover:scale-105 transition-transform" size={24} />
                    <div className="text-center">
                      <p className="text-[11px] font-semibold text-white uppercase tracking-wider">Arraste ou Selecione seu arquivo Excel</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Formatos suportados: .xlsx, .xls, .csv, .txt, .tsv</p>
                    </div>
                    {importedFileName && (
                      <div className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-mono text-blue-400 font-medium uppercase tracking-widest mt-1">
                        📂 {importedFileName}
                      </div>
                    )}
                  </div>

                  {/* Data Validation Checklist Filters for SOLICITANTE */}
                  {subTab === "pedidas" && parsedRows.length > 0 && uniqueSolicitantes.length > 0 && (
                    <div className="space-y-3 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-[10px] font-mono font-semibold text-white uppercase tracking-wider">Selecione os Solicitantes para Importar</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedSolicitantes(uniqueSolicitantes)}
                            className="text-[9px] font-mono font-medium text-blue-400 hover:text-blue-300 uppercase tracking-widest cursor-pointer bg-transparent border-none"
                          >
                            Marcar Todos
                          </button>
                          <span className="text-[9px] text-slate-700 font-mono">•</span>
                          <button
                            onClick={() => setSelectedSolicitantes([])}
                            className="text-[9px] font-mono font-medium text-rose-400 hover:text-rose-300 uppercase tracking-widest cursor-pointer bg-transparent border-none"
                          >
                            Desmarcar Todos
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-2">
                        {uniqueSolicitantes.map(name => {
                          const isChecked = selectedSolicitantes.includes(name)
                          const count = parsedRows.filter(r => r.solicitante === name).length
                          return (
                            <label key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer select-none transition-all">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedSolicitantes(prev => prev.filter(n => n !== name))
                                  } else {
                                    setSelectedSolicitantes(prev => [...prev, name])
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded border-slate-800 text-blue-600 bg-slate-950 focus:ring-blue-500/20 focus:ring-2 focus:ring-offset-0 cursor-pointer"
                              />
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-[10px] font-mono text-slate-300 font-medium truncate uppercase">{name}</span>
                                <span className="text-[8px] font-mono text-slate-500">{count} {count === 1 ? 'item' : 'itens'}</span>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-1 border-t border-white/5">
                        <span>Filtrados para importação:</span>
                        <span className="font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                          {parsedRows.filter(r => selectedSolicitantes.includes(r.solicitante)).length} de {parsedRows.length} linhas
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Simple success card for other tabs */}
                  {subTab !== "pedidas" && parsedRows.length > 0 && (
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-400" size={16} />
                        <span className="text-[10px] font-mono font-semibold text-white uppercase tracking-wider">Planilha carregada com sucesso</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                        {parsedRows.length} registros prontos
                      </span>
                    </div>
                  )}
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
                      no Supabase com o novo conteúdo da planilha.
                    </p>
                  </div>
                )}

                <button
                  disabled={
                    isImporting || 
                    parsedRows.length === 0 || 
                    (subTab === "pedidas" && selectedSolicitantes.length === 0)
                  }
                  onClick={async () => {
                    if (parsedRows.length === 0) return
                    
                    const payload = subTab === "pedidas"
                      ? parsedRows.filter(r => selectedSolicitantes.includes(r.solicitante))
                      : parsedRows

                    if (payload.length === 0) {
                      alert("Nenhum registro selecionado.")
                      return
                    }

                    const targetTable = subTab === "pedidas" ? "embalagens_pedidas" : subTab === "atuais" ? "embalagens_atuais" : "embalagens_chegando"
                    if (!confirm(`Confirmar importação de ${payload.length} itens? Isso será gravado no Supabase.`)) return
                    setIsImporting(true)
                    try {
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
                      setParsedRows([])
                      setSelectedSolicitantes([])
                      setImportedFileName("")
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

      {/* ─── MODAL: Adicionar item BA ao Estoque G300 ─── */}
      <AnimatePresence>
        {showAddG300Modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowAddG300Modal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden z-10"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Adicionar ao Estoque G300</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Selecione itens que já chegaram (com BA marcado no Cronograma)</p>
                </div>
                <button onClick={() => setShowAddG300Modal(false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              {/* Search */}
              <div className="px-6 py-3 border-b border-slate-800/60">
                <input
                  type="text"
                  placeholder="Buscar por produto ou embalagem..."
                  value={addG300Search}
                  onChange={e => setAddG300Search(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {(() => {
                  const baItems = pedidosBa.map((ba: any) => {
                    const relRow = pedidas.find(p =>
                      String(p.codigo || '').trim().toUpperCase() === String(ba.codigo_produto || '').trim().toUpperCase() &&
                      String(p.codigo_embalagem || '').trim().toUpperCase() === String(ba.codigo_embalagem || '').trim().toUpperCase()
                    )
                    return {
                      key: `${String(ba.codigo_produto).trim().toUpperCase()}||${String(ba.codigo_embalagem).trim().toUpperCase()}`,
                      codigo_produto: String(ba.codigo_produto || '').trim().toUpperCase(),
                      codigo_embalagem: String(ba.codigo_embalagem || '').trim().toUpperCase(),
                      descricao_embalagem: relRow?.descricao_embalagem || '',
                      modelo_produto: relRow?.modelo || relRow?.modelo_produto || '',
                    }
                  })
                  // Deduplica
                  const unique = Array.from(new Map(baItems.map((i: any) => [i.key, i])).values()) as any[]
                  const filtered = addG300Search
                    ? unique.filter((i: any) =>
                        i.codigo_produto.toLowerCase().includes(addG300Search.toLowerCase()) ||
                        i.codigo_embalagem.toLowerCase().includes(addG300Search.toLowerCase()) ||
                        (i.descricao_embalagem || '').toLowerCase().includes(addG300Search.toLowerCase()) ||
                        (i.modelo_produto || '').toLowerCase().includes(addG300Search.toLowerCase())
                      )
                    : unique

                  if (!filtered.length) return (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <Inbox size={28} className="mb-3 opacity-50" />
                      <p className="text-[11px]">Nenhum item com BA encontrado</p>
                    </div>
                  )

                  return filtered.map((item: any) => {
                    const isSelected = selectedBaItems.has(item.key)
                    const alreadyInG300 = estoqueG300.some((g: any) =>
                      String(g.codigo_produto || '').trim().toUpperCase() === item.codigo_produto &&
                      String(g.codigo_embalagem || '').trim().toUpperCase() === item.codigo_embalagem
                    )
                    return (
                      <div
                        key={item.key}
                        onClick={() => {
                          if (alreadyInG300) return
                          setSelectedBaItems(prev => {
                            const next = new Set(prev)
                            if (next.has(item.key)) next.delete(item.key)
                            else next.add(item.key)
                            return next
                          })
                        }}
                        className={cn(
                          "flex items-center gap-4 px-6 py-3.5 border-b border-slate-800/40 transition-colors",
                          alreadyInG300 ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.02]",
                          isSelected && !alreadyInG300 && "bg-emerald-500/[0.06]"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                          isSelected && !alreadyInG300 ? "bg-emerald-600 border-emerald-500" : "border-slate-600 bg-transparent"
                        )}>
                          {isSelected && !alreadyInG300 && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400">{item.codigo_produto}</span>
                            <span className="text-[9px] text-slate-600">·</span>
                            <span className="text-[10px] font-mono text-slate-400">{item.codigo_embalagem}</span>
                            {alreadyInG300 && <span className="text-[9px] text-slate-500 italic">(já cadastrado)</span>}
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5 truncate">{item.descricao_embalagem || '—'}</p>
                          {item.modelo_produto && <p className="text-[9px] text-slate-500 mt-0.5">{item.modelo_produto}</p>}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
                <p className="text-[10px] text-slate-500">
                  {selectedBaItems.size > 0 ? `${selectedBaItems.size} item(ns) selecionado(s)` : 'Selecione os itens para adicionar'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddG300Modal(false)}
                    className="px-4 py-2.5 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={selectedBaItems.size === 0}
                    onClick={() => {
                      const baItems = pedidosBa.map((ba: any) => {
                        const relRow = pedidas.find(p =>
                          String(p.codigo || '').trim().toUpperCase() === String(ba.codigo_produto || '').trim().toUpperCase() &&
                          String(p.codigo_embalagem || '').trim().toUpperCase() === String(ba.codigo_embalagem || '').trim().toUpperCase()
                        )
                        return {
                          key: `${String(ba.codigo_produto).trim().toUpperCase()}||${String(ba.codigo_embalagem).trim().toUpperCase()}`,
                          codigo_produto: String(ba.codigo_produto || '').trim().toUpperCase(),
                          codigo_embalagem: String(ba.codigo_embalagem || '').trim().toUpperCase(),
                          descricao_embalagem: relRow?.descricao_embalagem || '',
                          modelo_produto: relRow?.modelo || relRow?.modelo_produto || '',
                        }
                      })
                      const unique = Array.from(new Map(baItems.map((i: any) => [i.key, i])).values()) as any[]
                      const toAdd = unique.filter((i: any) => selectedBaItems.has(i.key))
                      const newRows = toAdd.map((item: any) => ({
                        codigo_embalagem: item.codigo_embalagem,
                        descricao_embalagem: item.descricao_embalagem,
                        codigo_produto: item.codigo_produto,
                        modelo_produto: item.modelo_produto,
                        cd: 0,
                        status: '',
                        isNew: true,
                        isDirty: true,
                      }))
                      setEstoqueG300([...newRows, ...estoqueG300])
                      setShowAddG300Modal(false)
                      setSelectedBaItems(new Set())
                    }}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all",
                      selectedBaItems.size > 0
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                        : "bg-slate-800 text-slate-600 cursor-not-allowed"
                    )}
                  >
                    <span className="flex items-center gap-2"><Plus size={12} /> Adicionar Selecionados</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
