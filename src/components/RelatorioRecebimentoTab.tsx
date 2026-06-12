"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Search,
  Package,
  FileText,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  Printer,
  Sheet,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RegistroRecebimento {
  id: number;
  Data: string;
  Produto: string;
  Entrada: number | null;
  Origem: string;
  transportadora?: string | null;
  nota_fiscal?: number | null;
  placa?: string | null;
  container?: string | null;
  lacre?: string | null;
  "Quantidade Molhada"?: number | null;
}

// ─────────────────────────────────────────────
// PRINT EXPORT HELPER (self-contained)
// ─────────────────────────────────────────────
function usePrintExport() {
  const printRef = useRef<HTMLDivElement>(null);

  const triggerPrint = (currentDate: Date) => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório de Recebimento — ${format(currentDate, "MMMM yyyy", { locale: ptBR }).toUpperCase()}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4 landscape;margin:12mm 10mm}
body{font-family:'DM Sans',sans-serif;font-size:8.5pt;color:#1e293b;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:100%;max-width:277mm;margin:0 auto}
.report-header{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #1e40af;padding-bottom:8px;margin-bottom:14px}
.brand{display:flex;align-items:center;gap:10px}
.brand-icon{width:32px;height:32px;background:#1e40af;border-radius:6px;display:flex;align-items:center;justify-content:center}
.brand-icon svg{width:18px;height:18px}
.brand-title{font-size:14pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f172a}
.brand-sub{font-size:7pt;letter-spacing:.25em;text-transform:uppercase;color:#64748b;margin-top:2px}
.report-meta{text-align:right;font-size:7.5pt;color:#64748b;line-height:1.8}
.report-meta strong{font-size:9pt;color:#0f172a;font-weight:700;text-transform:uppercase;letter-spacing:.1em}
.summary-strip{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:14px}
.stat-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px}
.stat-card.accent{background:#eff6ff;border-color:#bfdbfe}
.stat-card.accent-blue{background:#1e40af;border-color:#1e40af}
.stat-label{font-size:6.5pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px}
.stat-card.accent-blue .stat-label{color:#93c5fd}
.stat-value{font-family:'IBM Plex Mono',monospace;font-size:16pt;font-weight:700;color:#0f172a;line-height:1}
.stat-card.accent-blue .stat-value{color:#fff}
.stat-sub{font-size:6.5pt;color:#94a3b8;margin-top:3px}
.stat-card.accent-blue .stat-sub{color:#bfdbfe}
.section-title{font-size:7pt;font-weight:700;letter-spacing:.25em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #f1f5f9}
.content-grid{display:grid;grid-template-columns:1fr 1fr 200px;gap:12px;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:7.5pt}
thead tr{background:#f1f5f9}
th{padding:5px 7px;font-size:6.5pt;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#475569;text-align:left;border-bottom:1px solid #e2e8f0;white-space:nowrap}
td{padding:4.5px 7px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:middle}
tr:last-child td{border-bottom:none}
.mono{font-family:'IBM Plex Mono',monospace;font-size:7pt}
.day-row td{background:#eff6ff;font-weight:700;color:#1e40af;font-size:7pt;letter-spacing:.05em;text-transform:uppercase;padding:4px 7px}
.wet-badge{display:inline-flex;align-items:center;gap:3px;background:#dbeafe;color:#1d4ed8;font-size:6.5pt;font-weight:700;padding:1.5px 5px;border-radius:3px}
.wet-val{font-family:'IBM Plex Mono',monospace;font-weight:700;color:#1d4ed8}
.muted{color:#94a3b8}
.top-list{list-style:none}
.top-list li{display:flex;justify-content:space-between;align-items:center;padding:4.5px 0;border-bottom:1px solid #f1f5f9;gap:8px}
.top-list li:last-child{border-bottom:none}
.top-list .rank{font-size:7pt;font-weight:700;color:#bfdbfe;min-width:14px}
.top-list .name{flex:1;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#1e293b}
.top-list .desc{font-size:6pt;color:#94a3b8;margin-top:1px;text-transform:none;letter-spacing:0;font-weight:400;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.top-list .val{font-family:'IBM Plex Mono',monospace;font-size:9pt;font-weight:700;color:#0f172a}
.top-list .bar-wrap{width:60px;height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden}
.top-list .bar-fill{height:100%;background:#3b82f6;border-radius:2px}
.dist-row{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.dist-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dist-label{font-size:6.5pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#475569;flex:1}
.dist-val{font-family:'IBM Plex Mono',monospace;font-size:9pt;font-weight:700;color:#0f172a}
.dist-bar-wrap{width:100%;height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;margin-top:3px}
.dist-bar-fill{height:100%;border-radius:3px}
.report-footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:10px;font-size:6.5pt;color:#94a3b8}
</style>
</head>
<body>${content.innerHTML}</body>
</html>`);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 600);
  };

  return { printRef, triggerPrint };
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
const RelatorioRecebimentoTab = React.forwardRef<HTMLDivElement, {}>(
  function RelatorioRecebimentoTab(_props, ref) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [registros, setRegistros] = useState<RegistroRecebimento[]>([]);
    const [baseCodigos, setBaseCodigos] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTransportadora, setSelectedTransportadora] = useState<string>("all");
    const [hideEmptyDays, setHideEmptyDays] = useState(true);
    const [isTranspDropdownOpen, setIsTranspDropdownOpen] = useState(false);
    const [expandedNFs, setExpandedNFs] = useState<Record<string, boolean>>({});
    const [showAnalytics, setShowAnalytics] = useState(true);

    const { printRef, triggerPrint } = usePrintExport();

    const fetchData = async () => {
      setLoading(true);
      try {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");

        const [registrosRes, codigosRes] = await Promise.all([
          supabase
            .from("Registros")
            .select(`id, Data, Produto, Entrada, Origem, transportadora, nota_fiscal, placa, container, lacre, "Quantidade Molhada"`)
            .eq("Origem", "Recebimento")
            .gte("Data", startStr)
            .lte("Data", endStr)
            .order("Data", { ascending: false }),
          supabase.from("base_codigos").select('"Código", "Descrição"'),
        ]);

        if (registrosRes.error) throw registrosRes.error;
        if (codigosRes.error) throw codigosRes.error;

        setRegistros((registrosRes.data as RegistroRecebimento[]) || []);

        const codigosMap: Record<string, string> = {};
        (codigosRes.data || []).forEach((item) => {
          if (item.Código) codigosMap[item.Código.trim()] = item.Descrição;
        });
        setBaseCodigos(codigosMap);
      } catch (error) {
        console.error("Error fetching receiving report:", error);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => { fetchData(); }, [currentDate]);

    const handlePrevMonth = () => setCurrentDate((prev) => subMonths(prev, 1));
    const handleNextMonth = () => setCurrentDate((prev) => addMonths(prev, 1));

    const daysInMonth = useMemo(() => {
      return eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
    }, [currentDate]);

    const filteredRegistros = useMemo(() => {
      return registros.filter((r) => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          !searchTerm ||
          (r.Produto && r.Produto.toLowerCase().includes(term)) ||
          (r.transportadora && r.transportadora.toLowerCase().includes(term)) ||
          (r.nota_fiscal && String(r.nota_fiscal).includes(term)) ||
          (r.container && r.container.toLowerCase().includes(term)) ||
          (baseCodigos[r.Produto] && baseCodigos[r.Produto].toLowerCase().includes(term));
        if (!matchesSearch) return false;
        if (selectedTransportadora !== "all" && r.transportadora?.trim() !== selectedTransportadora) return false;
        return true;
      });
    }, [registros, searchTerm, selectedTransportadora, baseCodigos]);

    const groupedByDay = useMemo(() => {
      const grouped: Record<string, RegistroRecebimento[]> = {};
      daysInMonth.forEach((day) => { grouped[format(day, "yyyy-MM-dd")] = []; });
      filteredRegistros.forEach((reg) => {
        if (reg.Data && grouped[reg.Data]) grouped[reg.Data].push(reg);
      });
      return grouped;
    }, [filteredRegistros, daysInMonth]);

    const transportadoras = useMemo(() => {
      const list = new Set<string>();
      registros.forEach((r) => { if (r.transportadora) list.add(r.transportadora.trim()); });
      return Array.from(list).sort();
    }, [registros]);

    const filteredDays = useMemo(() => {
      return daysInMonth
        .filter((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const items = groupedByDay[dateStr] || [];
          if (hideEmptyDays && items.length === 0) return false;
          return true;
        })
        .reverse();
    }, [daysInMonth, groupedByDay, hideEmptyDays]);

    const chartData = useMemo(() => {
      const dataMap: Record<string, { date: string; avarias: number; molhada: number }> = {};
      eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }).forEach((day) => {
        const dayStr = format(day, "dd/MM");
        dataMap[dayStr] = { date: dayStr, avarias: 0, molhada: 0 };
      });
      filteredRegistros.forEach((r) => {
        try {
          const day = format(parseISO(r.Data), "dd/MM");
          if (dataMap[day]) {
            dataMap[day].avarias += r.Entrada || 0;
            dataMap[day].molhada += r["Quantidade Molhada"] || 0;
          }
        } catch (_) {}
      });
      return Object.values(dataMap);
    }, [filteredRegistros, currentDate]);

    const totalEntrada = useMemo(() => filteredRegistros.reduce((acc, curr) => acc + (curr.Entrada || 0), 0), [filteredRegistros]);
    const totalMolhada = useMemo(() => filteredRegistros.reduce((acc, curr) => acc + (curr["Quantidade Molhada"] || 0), 0), [filteredRegistros]);

    const donutData = useMemo(() => {
      const totalSecas = Math.max(0, totalEntrada - totalMolhada);
      return [
        { name: "AVARIAS SECAS", value: totalSecas, color: "#3b82f6" },
        { name: "AVARIAS MOLHADAS", value: totalMolhada, color: "#22d3ee" },
      ].filter((d) => d.value > 0);
    }, [totalEntrada, totalMolhada]);

    // ── All products ranked (replaces topStats.products top-3) ──
    const allProductsRanked = useMemo(() => {
      const prodCounts: Record<string, { total: number; molhada: number }> = {};
      filteredRegistros.forEach((r) => {
        const p = r.Produto || "—";
        if (!prodCounts[p]) prodCounts[p] = { total: 0, molhada: 0 };
        prodCounts[p].total += r.Entrada || 0;
        prodCounts[p].molhada += r["Quantidade Molhada"] || 0;
      });
      return Object.entries(prodCounts)
        .sort(([, a], [, b]) => b.total - a.total)
        .map(([name, stats]) => ({
          name,
          description: baseCodigos[name] || "—",
          total: stats.total,
          molhada: stats.molhada,
        }));
    }, [filteredRegistros, baseCodigos]);

    const topStats = useMemo(() => {
      const transpCounts: Record<string, { total: number; molhada: number; notas: Set<string | number> }> = {};
      const allNotas = new Set(filteredRegistros.map((r) => r.nota_fiscal).filter(Boolean));
      let maxDay = { date: "—", value: 0 };

      filteredRegistros.forEach((r) => {
        const t = r.transportadora?.trim() || "—";
        if (!transpCounts[t]) transpCounts[t] = { total: 0, molhada: 0, notas: new Set() };
        transpCounts[t].total += r.Entrada || 0;
        transpCounts[t].molhada += r["Quantidade Molhada"] || 0;
        if (r.nota_fiscal) transpCounts[t].notas.add(r.nota_fiscal);
      });

      chartData.forEach((d) => { if (d.avarias > maxDay.value) maxDay = { date: d.date, value: d.avarias }; });

      const carriers = Object.entries(transpCounts)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 3)
        .map(([name, stats]) => ({
          name: !name || name === "—" ? "NÃO INFORMADO" : name,
          value: stats.total,
          molhada: stats.molhada,
          notaCount: stats.notas.size,
        }));

      return { carriers, maxDay, totalNotas: allNotas.size };
    }, [filteredRegistros, chartData]);

    const toggleDay = (dateStr: string) => setExpandedDay((prev) => (prev === dateStr ? null : dateStr));

    // ── Derived values ──
    const totalSecas = Math.max(0, totalEntrada - totalMolhada);
    const mediaDiaria = (totalEntrada / (chartData.filter((d) => d.avarias > 0).length || 1)).toFixed(1);
    const maxCarrierVal = topStats.carriers[0]?.value || 1;

    const groupedByDayForPrint = useMemo(() => {
      const map: Record<string, RegistroRecebimento[]> = {};
      filteredRegistros.forEach((r) => {
        if (!map[r.Data]) map[r.Data] = [];
        map[r.Data].push(r);
      });
      return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
    }, [filteredRegistros]);

    // ── Excel export ──
    const exportToExcel = async () => {
      const XLSX = await import("xlsx");

      const wb = XLSX.utils.book_new();

      // Sheet 1: Resumo
      const summaryRows: (string | number)[][] = [
        ["RELATÓRIO DE RECEBIMENTO", format(currentDate, "MMMM yyyy", { locale: ptBR }).toUpperCase()],
        [],
        ["Total de Avarias", totalEntrada],
        ["Avarias Molhadas", totalMolhada],
        ["Outras Avarias", totalSecas],
        ["Total de Notas Fiscais", topStats.totalNotas],
        ["Média Diária", parseFloat(mediaDiaria)],
        ["Dia Crítico", topStats.maxDay.date],
        ["Pico do Dia Crítico", topStats.maxDay.value],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary["!cols"] = [{ wch: 28 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

      // Sheet 2: Registros detalhados
      const headers = [
        "Data",
        "Nota Fiscal",
        "Produto",
        "Descrição",
        "Transportadora",
        "Placa",
        "Container",
        "Lacre",
        "Av. Total",
        "Outras Av.",
        "Av. Molhada",
      ];
      const rows: (string | number | null)[][] = [headers];
      groupedByDayForPrint.forEach(([date, items]) => {
        let parsedDate: Date;
        try { parsedDate = new Date(date + "T12:00:00"); } catch { parsedDate = new Date(); }
        items.forEach((item) => {
          const entrada = item.Entrada || 0;
          const molhada = item["Quantidade Molhada"] || 0;
          rows.push([
            format(parsedDate, "dd/MM/yyyy"),
            item.nota_fiscal || "S/N",
            item.Produto,
            baseCodigos[item.Produto] || "—",
            item.transportadora || "—",
            item.placa || "—",
            item.container || "—",
            item.lacre || "—",
            entrada,
            entrada - molhada,
            molhada,
          ]);
        });
      });
      // Linha de totais
      rows.push([
        "TOTAL GERAL", "", "", "", "", "", "", "",
        totalEntrada,
        totalSecas,
        totalMolhada,
      ]);
      const wsRegistros = XLSX.utils.aoa_to_sheet(rows);
      wsRegistros["!cols"] = [12, 14, 12, 30, 22, 12, 16, 12, 10, 10, 12].map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsRegistros, "Registros");

      // Sheet 3: Todos os produtos rankeados
      const prodHeaders = [
        "Rank",
        "Produto",
        "Descrição",
        "Av. Total",
        "Av. Molhada",
        "Outras Av.",
        "% Molhada",
      ];
      const prodRows: (string | number)[][] = [prodHeaders];
      allProductsRanked.forEach((p, i) => {
        const outras = p.total - p.molhada;
        const pctMolhada = p.total > 0 ? parseFloat(((p.molhada / p.total) * 100).toFixed(1)) : 0;
        prodRows.push([i + 1, p.name, p.description, p.total, p.molhada, outras, pctMolhada]);
      });
      const wsProdutos = XLSX.utils.aoa_to_sheet(prodRows);
      wsProdutos["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 36 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsProdutos, "Produtos Rankeados");

      // Sheet 4: Transportadoras
      const transpHeaders = ["Rank", "Transportadora", "Av. Total", "Av. Molhada", "Notas Fiscais"];
      const transpRows: (string | number)[][] = [transpHeaders];
      topStats.carriers.forEach((c, i) => {
        transpRows.push([i + 1, c.name, c.value, c.molhada, c.notaCount]);
      });
      const wsTransp = XLSX.utils.aoa_to_sheet(transpRows);
      wsTransp["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsTransp, "Transportadoras");

      XLSX.writeFile(wb, `recebimento_${format(currentDate, "yyyy_MM")}.xlsx`);
    };

    return (
      <div ref={ref} className="flex flex-col h-full w-full min-w-full text-slate-900 dark:text-slate-200 font-sans">

        {/* ── HEADER ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 w-full">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="p-1">
                <Droplet className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight uppercase tracking-tight">
                  RELATÓRIO DE RECEBIMENTO
                </h2>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-blue-600 text-white">MENSAL</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">FLUXO DE AVARIAS</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Month nav */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-transparent">
              <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400">
                <ChevronLeft size={18} />
              </button>
              <div className="px-3 py-1 text-sm font-bold text-slate-900 dark:text-slate-300 min-w-[140px] text-center uppercase tracking-widest">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </div>
              <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Transportadora dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsTranspDropdownOpen(!isTranspDropdownOpen)}
                className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-2.5 px-4 rounded-xl border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  {selectedTransportadora === "all" ? "TODAS TRANSPORTADORAS" : selectedTransportadora}
                </span>
                <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-300", isTranspDropdownOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {isTranspDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsTranspDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-40 overflow-hidden"
                    >
                      <div className="p-2 flex flex-col gap-1 max-h-64 overflow-y-auto">
                        {["all", ...transportadoras].map((t) => (
                          <button
                            key={t}
                            onClick={() => { setSelectedTransportadora(t); setIsTranspDropdownOpen(false); }}
                            className={cn(
                              "w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                              selectedTransportadora === t ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            {t === "all" ? "TODAS TRANSPORTADORAS" : t}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Toggle empty days */}
            <button
              onClick={() => setHideEmptyDays(!hideEmptyDays)}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300",
                hideEmptyDays ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
              )}
            >
              {hideEmptyDays ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            {/* Toggle analytics */}
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={cn(
                "p-2 rounded-xl border transition-all",
                showAnalytics ? "bg-blue-600/10 border-blue-500/20 text-blue-500" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
              )}
            >
              <LayoutDashboard size={18} />
            </button>

            {/* Excel export button */}
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity"
            >
              <Sheet size={15} />
              Excel
            </button>

            {/* Print button */}
            <button
              onClick={() => triggerPrint(currentDate)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity"
            >
              <Printer size={15} />
              Imprimir
            </button>

            {/* Search */}
            <div className="relative w-full md:w-auto group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-blue-500" size={16} />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-48 rounded-2xl border border-transparent bg-white dark:bg-slate-900 py-2 pl-11 pr-5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500/20 transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* ── CONTENT LAYOUT ── */}
        <div className={cn("flex flex-1 gap-6 overflow-hidden w-full transition-all duration-300", !showAnalytics && "gap-0")}>

          {/* Side Analytics */}
          <AnimatePresence mode="wait">
            {showAnalytics && (
              <motion.div
                initial={{ width: 0, opacity: 0, x: -20 }}
                animate={{ width: 450, opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex-none bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 flex flex-col gap-8 overflow-y-auto relative"
              >
                {loading && (
                  <div className="absolute inset-0 z-50 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Sincronizando...</p>
                    </div>
                  </div>
                )}

                {/* Distribution */}
                <section className="flex flex-col gap-6">
                  <div className="text-center">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">Distribuição de Avarias</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Comparativo Mensal</p>
                  </div>
                  <div className="flex flex-col gap-4 mt-2">
                    {donutData.length > 0 ? donutData.map((item, idx) => {
                      const total = donutData.reduce((acc, curr) => acc + curr.value, 0) || 1;
                      const percentage = (item.value / total) * 100;
                      return (
                        <div key={idx}>
                          <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.name}</span>
                            </div>
                            <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{item.value}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="flex flex-col items-center py-8 text-slate-300 dark:text-slate-700">
                        <Package size={40} strokeWidth={1} />
                        <p className="text-[10px] uppercase tracking-widest mt-4 font-bold">Sem dados para exibição</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex items-center justify-between mt-2">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Total Geral</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                      {donutData.reduce((acc, curr) => acc + curr.value, 0)}
                    </span>
                  </div>
                </section>

                {/* Fluxo Diário */}
                <section className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Fluxo Diário</h3>
                    <span className="text-[9px] font-bold text-blue-500 uppercase">Pico: {topStats.maxDay.value}</span>
                  </div>
                  <div className="h-[120px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorAvarias" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415520" />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "8px", fontSize: "10px" }}
                          itemStyle={{ color: "#fff" }}
                        />
                        <Area type="monotone" dataKey="avarias" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAvarias)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* ── TODOS OS PRODUTOS RANKEADOS ── */}
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                      Produtos Afetados
                    </h3>
                    <span className="text-[9px] font-bold text-blue-500 uppercase">
                      {allProductsRanked.length} produto{allProductsRanked.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {allProductsRanked.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-slate-300 dark:text-slate-700">
                      <Package size={32} strokeWidth={1} />
                      <p className="text-[10px] uppercase tracking-widest mt-3 font-bold">Sem dados</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                      {allProductsRanked.map((p, i) => {
                        const maxVal = allProductsRanked[0]?.total || 1;
                        const barWidth = (p.total / maxVal) * 100;
                        return (
                          <div key={i} className="relative flex flex-col gap-0.5 group rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            {/* Background bar */}
                            <div
                              className="absolute left-0 top-0 bottom-0 bg-blue-500/5 rounded-lg -z-0 transition-all group-hover:bg-blue-500/8"
                              style={{ width: `${barWidth}%` }}
                            />
                            <div className="flex items-center justify-between z-10">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold text-blue-500/40 w-5 shrink-0 text-right">{i + 1}</span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight leading-tight">
                                    {p.name}
                                  </span>
                                  <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[170px] leading-tight">
                                    {p.description}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 z-10 shrink-0 ml-2">
                                {p.molhada > 0 && (
                                  <span className="text-[9px] font-bold text-cyan-500 flex items-center gap-0.5 bg-cyan-500/10 px-1.5 py-0.5 rounded-full">
                                    <Droplet size={8} fill="currentColor" />
                                    {p.molhada}
                                  </span>
                                )}
                                <span className="text-[12px] font-black text-slate-900 dark:text-white font-mono leading-none">
                                  {p.total}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Transportadoras */}
                <section className="flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
                  <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Maiores Ocorrências por Transp.</h3>
                  <div className="space-y-3">
                    {topStats.carriers.map((c, i) => (
                      <div key={i} className="relative flex items-center justify-between p-1 group">
                        <div className="flex items-center gap-3 z-10">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{c.name}</span>
                        </div>
                        <div className="flex flex-col items-end z-10">
                          <span className="text-[11px] font-black text-slate-900 dark:text-white leading-none">{c.value}</span>
                          <div className="flex items-center gap-2 mt-1">
                            {c.molhada > 0 && (
                              <span className="text-[9px] font-bold text-blue-500 flex items-center gap-0.5">
                                <Droplet size={8} fill="currentColor" />{c.molhada}
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5">
                              <FileText size={8} />{c.notaCount}
                            </span>
                          </div>
                        </div>
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-slate-500/5 dark:bg-blue-500/5 rounded-md -z-0 group-hover:bg-blue-500/10"
                          style={{ width: `${(c.value / maxCarrierVal) * 100}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                {/* Footer stats */}
                <div className="mt-auto bg-blue-600 dark:bg-blue-600/10 p-4 rounded-2xl flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-blue-100 dark:text-blue-400 uppercase tracking-widest">Total de Notas</span>
                    <span className="text-lg font-black text-white dark:text-blue-400">{topStats.totalNotas}</span>
                  </div>
                  <div className="flex flex-col items-center border-l border-white/20 dark:border-blue-400/20 pl-4">
                    <span className="text-[9px] font-bold text-blue-100 dark:text-blue-400 uppercase tracking-widest">Média Diária</span>
                    <span className="text-lg font-black text-white dark:text-blue-400">{mediaDiaria}</span>
                  </div>
                  <div className="flex flex-col items-end border-l border-white/20 dark:border-blue-400/20 pl-4">
                    <span className="text-[9px] font-bold text-blue-100 dark:text-blue-400 uppercase tracking-widest">Dia Crítico</span>
                    <span className="text-lg font-black text-white dark:text-blue-400 uppercase">{topStats.maxDay.date}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── TABLE ── */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-x-auto overflow-y-auto bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm rounded-2xl relative mx-6 print:mx-0">
              <table className="w-full text-left border-collapse text-sm whitespace-nowrap min-w-[1000px]">
                <thead className="sticky top-0 z-20 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-[150px]">Data</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-full">Resumo Operacional</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400 w-[120px] text-center uppercase tracking-widest text-[10px]">Av Totais</th>
                    <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-500 w-[120px] text-center uppercase tracking-widest text-[10px]">Outras Av</th>
                    <th className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400 w-[120px] text-center uppercase tracking-widest text-[10px]">Av Molh</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-[100px] text-center">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="animate-spin text-blue-500" size={32} />
                          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando registros...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredDays.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhum registro encontrado neste mês</p>
                      </td>
                    </tr>
                  ) : (
                    filteredDays.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const items = groupedByDay[dateStr] || [];
                      const isExpanded = expandedDay === dateStr;
                      const hasItems = items.length > 0;
                      const dayEntrada = items.reduce((acc, curr) => acc + (curr.Entrada || 0), 0);
                      const dayMolhada = items.reduce((acc, curr) => acc + (curr["Quantidade Molhada"] || 0), 0);
                      const dayOutras = dayEntrada - dayMolhada;

                      return (
                        <React.Fragment key={dateStr}>
                          <tr
                            onClick={() => hasItems && toggleDay(dateStr)}
                            className={cn(
                              "transition-all group relative z-0 border-none",
                              hasItems ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" : "opacity-50 grayscale cursor-default",
                              isExpanded && "bg-slate-50 dark:bg-slate-800/80"
                            )}
                          >
                            <td className="px-5 py-3.5 text-sm font-mono text-slate-600 dark:text-slate-300">{format(day, "dd/MM/yyyy")}</td>
                            <td className="px-5 py-3.5">
                              {hasItems ? (
                                <div className="flex items-center gap-3">
                                  <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    {format(day, "EEEE", { locale: ptBR })}
                                  </span>
                                  {dayMolhada > 0 && (
                                    <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5 uppercase tracking-[0.1em]">
                                      <Droplet size={10} fill="currentColor" className="animate-pulse" /> Alerta: Avaria Molhada
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[12px] text-slate-400 italic">Sem movimentação</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={cn("font-bold font-mono text-sm", hasItems ? "text-slate-700 dark:text-slate-200" : "text-slate-400")}>
                                {hasItems ? dayEntrada : "—"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={cn("font-bold font-mono text-sm", hasItems ? "text-slate-500 dark:text-slate-500" : "text-slate-400")}>
                                {hasItems ? dayOutras : "—"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {dayMolhada > 0 ? (
                                <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10">
                                  <Droplet size={12} className="text-blue-600 dark:text-blue-400 animate-pulse" />
                                  <span className="font-black font-mono text-sm text-blue-600 dark:text-blue-400">{dayMolhada}</span>
                                </div>
                              ) : (
                                <span className="font-bold font-mono text-sm text-slate-300 dark:text-slate-700">0</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              {hasItems && (
                                <ChevronDown size={18} className={cn("text-slate-400 transition-transform duration-300", isExpanded && "rotate-180 text-blue-500")} />
                              )}
                            </td>
                          </tr>

                          {/* Expanded detail */}
                          <AnimatePresence>
                            {isExpanded && hasItems && (
                              <motion.tr
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="bg-slate-50/30 dark:bg-slate-900/40"
                              >
                                <td colSpan={6} className="p-0 border-none">
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: "auto" }}
                                    exit={{ height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="overflow-hidden"
                                  >
                                    <table className="w-full text-left">
                                      <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                                        <tr>
                                          <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[120px]">Nota Fiscal</th>
                                          <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Produto</th>
                                          <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Descrição</th>
                                          <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px]">Av Totais</th>
                                          <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-[80px]">Outras Av</th>
                                          <th className="px-5 py-3 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest w-[80px]">Av Molh</th>
                                          <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Transportadora</th>
                                          <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Placa</th>
                                          <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Container</th>
                                          <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Lacre</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(() => {
                                          const groupedByNF: Record<string, RegistroRecebimento[]> = {};
                                          items.forEach((item) => {
                                            const nf = item.nota_fiscal?.toString() || "S/N";
                                            if (!groupedByNF[nf]) groupedByNF[nf] = [];
                                            groupedByNF[nf].push(item);
                                          });

                                          return Object.entries(groupedByNF).map(([nf, nfItems]) => {
                                            const isMulti = nfItems.length > 1;
                                            const isNFExpanded = expandedNFs[`${dateStr}-${nf}`];
                                            const nfEntrada = nfItems.reduce((acc, curr) => acc + (curr.Entrada || 0), 0);
                                            const nfMolh = nfItems.reduce((acc, curr) => acc + (curr["Quantidade Molhada"] || 0), 0);
                                            const nfOutras = nfEntrada - nfMolh;

                                            return (
                                              <React.Fragment key={nf}>
                                                <tr
                                                  className={cn(
                                                    "transition-colors group border-b border-slate-200/60 dark:border-slate-800/40",
                                                    isMulti ? "cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-500/5" : "hover:bg-slate-100/50 dark:hover:bg-slate-800/60"
                                                  )}
                                                  onClick={() => {
                                                    if (isMulti) {
                                                      setExpandedNFs((prev) => ({ ...prev, [`${dateStr}-${nf}`]: !prev[`${dateStr}-${nf}`] }));
                                                    }
                                                  }}
                                                >
                                                  <td className="px-5 py-3.5 text-sm font-mono font-bold text-slate-700 dark:text-slate-200">
                                                    <div className="flex items-center gap-2">
                                                      {nf}
                                                      {isMulti && <ChevronDown size={14} className={cn("text-blue-500 transition-transform duration-200", isNFExpanded && "rotate-180")} />}
                                                    </div>
                                                  </td>
                                                  <td className="px-5 py-3.5 text-sm font-mono text-slate-600 dark:text-slate-400">
                                                    {isMulti ? (
                                                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter bg-blue-500/10 px-1.5 py-0.5 rounded-sm">
                                                        Múltiplos ({nfItems.length})
                                                      </span>
                                                    ) : nfItems[0].Produto}
                                                  </td>
                                                  <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                                    {isMulti ? "—" : (baseCodigos[nfItems[0].Produto] || "—")}
                                                  </td>
                                                  <td className="px-5 py-3.5 text-sm font-mono text-slate-700 dark:text-slate-300">
                                                    {isMulti ? nfEntrada : nfItems[0].Entrada || 0}
                                                  </td>
                                                  <td className="px-5 py-3.5 text-sm font-mono text-slate-500 dark:text-slate-400">
                                                    {isMulti ? nfOutras : (nfItems[0].Entrada || 0) - (nfItems[0]["Quantidade Molhada"] || 0)}
                                                  </td>
                                                  <td className="px-5 py-3.5 text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                                                    {isMulti ? (nfMolh > 0 ? nfMolh : "—") : ((nfItems[0]["Quantidade Molhada"] || 0) > 0 ? nfItems[0]["Quantidade Molhada"] : "—")}
                                                  </td>
                                                  <td className="px-5 py-3.5 text-xs font-mono text-slate-500 dark:text-slate-400">{nfItems[0].transportadora || "—"}</td>
                                                  <td className="px-5 py-3.5 text-xs font-mono uppercase text-slate-500 dark:text-slate-400">{nfItems[0].placa || "—"}</td>
                                                  <td className="px-5 py-3.5 text-xs font-mono uppercase text-slate-500 dark:text-slate-400">{nfItems[0].container || "—"}</td>
                                                  <td className="px-5 py-3.5 text-xs font-mono uppercase text-slate-500 dark:text-slate-400">{nfItems[0].lacre || "—"}</td>
                                                </tr>
                                                <AnimatePresence>
                                                  {isMulti && isNFExpanded && nfItems.map((item, idx) => (
                                                    <motion.tr
                                                      key={`${item.id}-detail`}
                                                      initial={{ opacity: 0, x: -10 }}
                                                      animate={{ opacity: 1, x: 0 }}
                                                      exit={{ opacity: 0, x: -10 }}
                                                      transition={{ delay: idx * 0.05 }}
                                                      className="bg-blue-50/20 dark:bg-blue-500/[0.02] border-l-4 border-blue-500/40 border-b border-slate-200/30 dark:border-slate-800/20"
                                                    >
                                                      <td className="px-5 py-2.5 text-center text-[10px] font-bold text-blue-500/30">"</td>
                                                      <td className="px-5 py-2.5 text-sm font-mono text-slate-700 dark:text-slate-300 font-bold">{item.Produto}</td>
                                                      <td className="px-5 py-2.5 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{baseCodigos[item.Produto] || "—"}</td>
                                                      <td className="px-5 py-2.5 text-sm font-mono text-slate-700 dark:text-slate-300">{item.Entrada || 0}</td>
                                                      <td className="px-5 py-2.5 text-sm font-mono text-slate-500 dark:text-slate-400">{(item.Entrada || 0) - (item["Quantidade Molhada"] || 0)}</td>
                                                      <td className="px-5 py-2.5 text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                                                        {(item["Quantidade Molhada"] || 0) > 0 ? item["Quantidade Molhada"] : "—"}
                                                      </td>
                                                      <td colSpan={4} className="px-5 py-2.5 text-center text-[10px] font-bold text-blue-500/30 italic">
                                                        Detalhes agrupados na nota fiscal
                                                      </td>
                                                    </motion.tr>
                                                  ))}
                                                </AnimatePresence>
                                              </React.Fragment>
                                            );
                                          });
                                        })()}
                                      </tbody>
                                    </table>
                                  </motion.div>
                                </td>
                              </motion.tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── HIDDEN PRINT CONTENT ── */}
        <div style={{ position: "absolute", left: "-9999px", top: 0, width: "277mm" }} aria-hidden="true">
          <div ref={printRef} className="page">
            {/* Header */}
            <div className="report-header">
              <div className="brand">
                <div className="brand-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div>
                  <div className="brand-title">Relatório de Recebimento</div>
                  <div className="brand-sub">Fluxo de Avarias · Mensal</div>
                </div>
              </div>
              <div className="report-meta">
                <strong>{format(currentDate, "MMMM yyyy", { locale: ptBR })}</strong><br />
                Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}<br />
                Origem: Recebimento
              </div>
            </div>

            {/* Summary strip */}
            <div className="summary-strip">
              {[
                { cls: "accent-blue", label: "Total Avarias", val: totalEntrada, sub: "Todas as origens" },
                { cls: "accent", label: "Av. Molhadas", val: totalMolhada, sub: `${totalEntrada > 0 ? ((totalMolhada / totalEntrada) * 100).toFixed(1) : 0}% do total`, valColor: "#1d4ed8" },
                { cls: "", label: "Outras Av.", val: totalSecas, sub: "Secas / outras" },
                { cls: "", label: "Notas Fiscais", val: topStats.totalNotas, sub: "NFs processadas" },
                { cls: "", label: "Média Diária", val: mediaDiaria, sub: "Avarias/dia útil" },
                { cls: "accent", label: "Dia Crítico", val: topStats.maxDay.date, sub: `Pico: ${topStats.maxDay.value} av.`, valColor: "#1d4ed8", valSize: "13pt" },
              ].map((s, i) => (
                <div key={i} className={`stat-card ${s.cls}`}>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.valColor, fontSize: s.valSize as string | undefined }}>{s.val}</div>
                  <div className="stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* 3-col grid */}
            <div className="content-grid">
              {/* Main table */}
              <div style={{ gridColumn: "1 / 3" }}>
                <div className="section-title">Registros Detalhados por Dia</div>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 72 }}>Data</th>
                      <th style={{ width: 60 }}>NF</th>
                      <th style={{ width: 60 }}>Produto</th>
                      <th>Descrição</th>
                      <th style={{ width: 55 }}>Transportadora</th>
                      <th style={{ width: 60 }}>Placa</th>
                      <th style={{ width: 65 }}>Container</th>
                      <th style={{ width: 50 }}>Lacre</th>
                      <th style={{ width: 44, textAlign: "center" }}>Av. Total</th>
                      <th style={{ width: 44, textAlign: "center" }}>Outras</th>
                      <th style={{ width: 50, textAlign: "center" }}>Molhada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedByDayForPrint.map(([date, items]) => {
                      const dayTotal = items.reduce((a, c) => a + (c.Entrada || 0), 0);
                      const dayMolh = items.reduce((a, c) => a + (c["Quantidade Molhada"] || 0), 0);
                      const byNF: Record<string, RegistroRecebimento[]> = {};
                      items.forEach((it) => {
                        const k = it.nota_fiscal?.toString() || "S/N";
                        if (!byNF[k]) byNF[k] = [];
                        byNF[k].push(it);
                      });
                      let parsedDate: Date;
                      try { parsedDate = new Date(date + "T12:00:00"); } catch { parsedDate = new Date(); }

                      return (
                        <React.Fragment key={date}>
                          <tr className="day-row">
                            <td>{format(parsedDate, "dd/MM/yyyy")}</td>
                            <td colSpan={7} style={{ textTransform: "capitalize" }}>
                              {format(parsedDate, "EEEE", { locale: ptBR })}
                              {dayMolh > 0 && <span className="wet-badge" style={{ marginLeft: 8 }}>● Avaria Molhada</span>}
                            </td>
                            <td className="mono" style={{ textAlign: "center", color: "#0f172a" }}>{dayTotal}</td>
                            <td className="mono" style={{ textAlign: "center", color: "#475569" }}>{dayTotal - dayMolh}</td>
                            <td style={{ textAlign: "center" }}>
                              {dayMolh > 0 ? <span className="wet-val">{dayMolh}</span> : <span className="muted">—</span>}
                            </td>
                          </tr>
                          {Object.entries(byNF).map(([nf, nfItems]) => {
                            const nfTotal = nfItems.reduce((a, c) => a + (c.Entrada || 0), 0);
                            const nfMolh = nfItems.reduce((a, c) => a + (c["Quantidade Molhada"] || 0), 0);
                            const isMulti = nfItems.length > 1;
                            if (isMulti) {
                              return (
                                <React.Fragment key={nf}>
                                  <tr>
                                    <td className="muted">—</td>
                                    <td className="mono" style={{ fontWeight: 700 }}>{nf}</td>
                                    <td colSpan={2} style={{ fontStyle: "italic", color: "#64748b", fontSize: "6.5pt" }}>{nfItems.length} itens agrupados</td>
                                    <td>{nfItems[0].transportadora || "—"}</td>
                                    <td className="mono">{nfItems[0].placa || "—"}</td>
                                    <td className="mono">{nfItems[0].container || "—"}</td>
                                    <td className="mono">{nfItems[0].lacre || "—"}</td>
                                    <td className="mono" style={{ textAlign: "center", fontWeight: 700 }}>{nfTotal}</td>
                                    <td className="mono" style={{ textAlign: "center", color: "#64748b" }}>{nfTotal - nfMolh}</td>
                                    <td style={{ textAlign: "center" }}>{nfMolh > 0 ? <span className="wet-val">{nfMolh}</span> : <span className="muted">—</span>}</td>
                                  </tr>
                                  {nfItems.map((item) => (
                                    <tr key={item.id} style={{ background: "#fafbff" }}>
                                      <td /><td style={{ color: "#bfdbfe", fontSize: "6pt" }}>╰</td>
                                      <td className="mono" style={{ fontWeight: 700, color: "#1e293b" }}>{item.Produto}</td>
                                      <td style={{ color: "#64748b", fontSize: "6.5pt" }}>{baseCodigos[item.Produto] || "—"}</td>
                                      <td colSpan={4} />
                                      <td className="mono" style={{ textAlign: "center" }}>{item.Entrada || 0}</td>
                                      <td className="mono" style={{ textAlign: "center", color: "#64748b" }}>{(item.Entrada || 0) - (item["Quantidade Molhada"] || 0)}</td>
                                      <td style={{ textAlign: "center" }}>
                                        {(item["Quantidade Molhada"] || 0) > 0 ? <span className="wet-val">{item["Quantidade Molhada"]}</span> : <span className="muted">—</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              );
                            }
                            const item = nfItems[0];
                            return (
                              <tr key={nf}>
                                <td className="muted">—</td>
                                <td className="mono" style={{ fontWeight: 700 }}>{nf}</td>
                                <td className="mono" style={{ fontWeight: 700, color: "#1e293b" }}>{item.Produto}</td>
                                <td style={{ color: "#64748b", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{baseCodigos[item.Produto] || "—"}</td>
                                <td>{item.transportadora || "—"}</td>
                                <td className="mono">{item.placa || "—"}</td>
                                <td className="mono">{item.container || "—"}</td>
                                <td className="mono">{item.lacre || "—"}</td>
                                <td className="mono" style={{ textAlign: "center", fontWeight: 700 }}>{item.Entrada || 0}</td>
                                <td className="mono" style={{ textAlign: "center", color: "#64748b" }}>{(item.Entrada || 0) - (item["Quantidade Molhada"] || 0)}</td>
                                <td style={{ textAlign: "center" }}>
                                  {(item["Quantidade Molhada"] || 0) > 0 ? <span className="wet-val">{item["Quantidade Molhada"]}</span> : <span className="muted">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    <tr style={{ background: "#eff6ff", fontWeight: 700 }}>
                      <td colSpan={8} style={{ textAlign: "right", fontWeight: 700, letterSpacing: "0.1em", fontSize: "7pt", textTransform: "uppercase", color: "#1e40af" }}>TOTAL GERAL</td>
                      <td className="mono" style={{ textAlign: "center", fontWeight: 700, color: "#0f172a", fontSize: "9pt" }}>{totalEntrada}</td>
                      <td className="mono" style={{ textAlign: "center", color: "#475569", fontSize: "9pt" }}>{totalSecas}</td>
                      <td style={{ textAlign: "center" }}><span className="wet-val" style={{ fontSize: "9pt" }}>{totalMolhada}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Side analytics for print */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div className="section-title">Distribuição de Avarias</div>
                  {[
                    { label: "Avarias Secas", value: totalSecas, color: "#3b82f6", pct: totalEntrada > 0 ? (totalSecas / totalEntrada) * 100 : 0 },
                    { label: "Avarias Molhadas", value: totalMolhada, color: "#22d3ee", pct: totalEntrada > 0 ? (totalMolhada / totalEntrada) * 100 : 0 },
                  ].map((d) => (
                    <div key={d.label} style={{ marginBottom: 10 }}>
                      <div className="dist-row">
                        <div className="dist-dot" style={{ background: d.color }} />
                        <div className="dist-label">{d.label}</div>
                        <div className="dist-val">{d.value}</div>
                      </div>
                      <div className="dist-bar-wrap">
                        <div className="dist-bar-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* All products ranked for print */}
                <div>
                  <div className="section-title">Todos os Produtos (Maior → Menor)</div>
                  <ul className="top-list">
                    {allProductsRanked.map((p, i) => (
                      <li key={i}>
                        <span className="rank">{i + 1}</span>
                        <span className="name">
                          {p.name}
                          <div className="desc">{p.description}</div>
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                          <span className="val">{p.total}</span>
                          {p.molhada > 0 && (
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6pt", color: "#0ea5e9", fontWeight: 700 }}>
                              ◉ {p.molhada} molh.
                            </span>
                          )}
                          <div className="bar-wrap">
                            <div className="bar-fill" style={{ width: `${(p.total / (allProductsRanked[0]?.total || 1)) * 100}%` }} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="section-title">Maiores Transportadoras</div>
                  <ul className="top-list">
                    {topStats.carriers.map((c, i) => (
                      <li key={i}>
                        <span className="rank">{i + 1}</span>
                        <span className="name">{c.name}</span>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                          <span className="val">{c.value}</span>
                          <div className="bar-wrap"><div className="bar-fill" style={{ width: `${(c.value / maxCarrierVal) * 100}%` }} /></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: "auto", borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
                  <div style={{ fontSize: "6.5pt", color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>Responsável</div>
                  <div style={{ borderBottom: "1px solid #334155", marginBottom: 4, height: 18 }} />
                  <div style={{ fontSize: "6.5pt", color: "#94a3b8", textAlign: "center" }}>Assinatura / Data</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="report-footer">
              <span>Relatório de Recebimento · {format(currentDate, "MMMM yyyy", { locale: ptBR })} · Gerado automaticamente</span>
              <span>Página 1</span>
            </div>
          </div>
        </div>

      </div>
    );
  }
);

RelatorioRecebimentoTab.displayName = "RelatorioRecebimentoTab";

export default RelatorioRecebimentoTab;
