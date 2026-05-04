"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar as CalendarIcon, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Droplet, 
  Search,
  Package,
  FileText,
  Truck,
  Box,
  Hash,
  Lock,
  Loader2,
  Eye,
  EyeOff
} from "lucide-react";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
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

export default React.forwardRef(function RelatorioRecebimentoTab(props, ref) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [registros, setRegistros] = useState<RegistroRecebimento[]>([]);
  const [baseCodigos, setBaseCodigos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransportadora, setSelectedTransportadora] = useState<string>("all");
  const [hideEmptyDays, setHideEmptyDays] = useState(true);
  const [isTranspDropdownOpen, setIsTranspDropdownOpen] = useState(false);
  const [observations, setObservations] = useState("");
  const [expandedNFs, setExpandedNFs] = useState<Record<string, boolean>>({});



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
        supabase
          .from("base_codigos")
          .select('"Código", "Descrição"')
      ]);

      if (registrosRes.error) throw registrosRes.error;
      if (codigosRes.error) throw codigosRes.error;

      setRegistros(registrosRes.data as RegistroRecebimento[] || []);
      
      const codigosMap: Record<string, string> = {};
      (codigosRes.data || []).forEach(item => {
        if (item.Código) codigosMap[item.Código.trim()] = item.Descrição;
      });
      setBaseCodigos(codigosMap);
    } catch (error) {
      console.error("Error fetching receiving report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentDate]);



  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
  const handleCurrentMonth = () => setCurrentDate(new Date());

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const groupedByDay = useMemo(() => {
    const grouped: Record<string, RegistroRecebimento[]> = {};
    daysInMonth.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      grouped[dateStr] = [];
    });
    registros.forEach(reg => {
      if (reg.Data && grouped[reg.Data]) {
        grouped[reg.Data].push(reg);
      }
    });
    return grouped;
  }, [registros, daysInMonth]);

  const transportadoras = useMemo(() => {
    const list = new Set<string>();
    registros.forEach(r => {
      if (r.transportadora) list.add(r.transportadora.trim());
    });
    return Array.from(list).sort();
  }, [registros]);

  const filteredDays = useMemo(() => {
    return daysInMonth.filter(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const items = groupedByDay[dateStr] || [];
      
      // Filter by "Hide Empty Days"
      if (hideEmptyDays && items.length === 0) return false;

      // Filter by Search Term
      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || items.some(item => 
        (item.Produto && item.Produto.toLowerCase().includes(term)) ||
        (item.transportadora && item.transportadora.toLowerCase().includes(term)) ||
        (item.nota_fiscal && String(item.nota_fiscal).includes(term)) ||
        (item.container && item.container.toLowerCase().includes(term)) ||
        (baseCodigos[item.Produto] && baseCodigos[item.Produto].toLowerCase().includes(term))
      );

      if (!matchesSearch) return false;

      // Filter by Transportadora
      if (selectedTransportadora !== "all") {
        const matchesTransp = items.some(item => item.transportadora?.trim() === selectedTransportadora);
        if (!matchesTransp) return false;
      }

      return true;
    }).reverse();
  }, [daysInMonth, groupedByDay, searchTerm, baseCodigos, hideEmptyDays, selectedTransportadora]);

  const filteredRegistros = useMemo(() => {
    return registros.filter(r => {
      // Filter by Search Term
      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        (r.Produto && r.Produto.toLowerCase().includes(term)) ||
        (r.transportadora && r.transportadora.toLowerCase().includes(term)) ||
        (r.nota_fiscal && String(r.nota_fiscal).includes(term)) ||
        (r.container && r.container.toLowerCase().includes(term)) ||
        (baseCodigos[r.Produto] && baseCodigos[r.Produto].toLowerCase().includes(term));

      if (!matchesSearch) return false;

      // Filter by Transportadora
      if (selectedTransportadora !== "all") {
        if (r.transportadora?.trim() !== selectedTransportadora) return false;
      }

      return true;
    });
  }, [registros, searchTerm, selectedTransportadora, baseCodigos]);

  const chartData = useMemo(() => {
    const dataMap: Record<string, { date: string, avarias: number, molhada: number }> = {};
    
    // Get all days of the month to show a complete timeline
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    days.forEach(day => {
      const dayStr = format(day, "dd/MM");
      dataMap[dayStr] = { date: dayStr, avarias: 0, molhada: 0 };
    });

    filteredRegistros.forEach(r => {
      try {
        const day = format(parseISO(r.Data), "dd/MM");
        if (dataMap[day]) {
          dataMap[day].avarias += (r.Entrada || 0);
          dataMap[day].molhada += (r["Quantidade Molhada"] || 0);
        }
      } catch (e) {}
    });

    return Object.values(dataMap);
  }, [filteredRegistros, currentDate]);

  const COLORS = ["#3b82f6", "#22d3ee", "#818cf8", "#2dd4bf"];

  const totalEntrada = useMemo(() => filteredRegistros.reduce((acc, curr) => acc + (curr.Entrada || 0), 0), [filteredRegistros]);
  const totalMolhada = useMemo(() => filteredRegistros.reduce((acc, curr) => acc + (curr["Quantidade Molhada"] || 0), 0), [filteredRegistros]);
  
  const donutData = useMemo(() => {
    const totalSecas = Math.max(0, totalEntrada - totalMolhada);
    return [
      { name: "AVARIAS SECAS", value: totalSecas, color: "#3b82f6" },
      { name: "AVARIAS MOLHADAS", value: totalMolhada, color: "#22d3ee" }
    ].filter(d => d.value > 0);
  }, [totalEntrada, totalMolhada]);

  const pieData = donutData;

  const topStats = useMemo(() => {
    const prodCounts: Record<string, { total: number, molhada: number, notas: Set<string|number> }> = {};
    const transpCounts: Record<string, { total: number, molhada: number, notas: Set<string|number> }> = {};
    const allNotas = new Set(filteredRegistros.map(r => r.nota_fiscal).filter(Boolean));
    let maxDay = { date: "—", value: 0 };

    filteredRegistros.forEach(r => {
      // Products
      const p = r.Produto || "—";
      if (!prodCounts[p]) prodCounts[p] = { total: 0, molhada: 0, notas: new Set() };
      prodCounts[p].total += (r.Entrada || 0);
      prodCounts[p].molhada += (r["Quantidade Molhada"] || 0);
      if (r.nota_fiscal) prodCounts[p].notas.add(r.nota_fiscal);

      // Carriers
      const t = r.transportadora?.trim() || "—";
      if (!transpCounts[t]) transpCounts[t] = { total: 0, molhada: 0, notas: new Set() };
      transpCounts[t].total += (r.Entrada || 0);
      transpCounts[t].molhada += (r["Quantidade Molhada"] || 0);
      if (r.nota_fiscal) transpCounts[t].notas.add(r.nota_fiscal);
    });

    // Max Day calculation from chartData logic
    chartData.forEach(d => {
      if (d.avarias > maxDay.value) {
        maxDay = { date: d.date, value: d.avarias };
      }
    });

    const products = Object.entries(prodCounts)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 3)
      .map(([name, stats]) => ({ 
        name, 
        description: baseCodigos[name] || "—",
        value: stats.total,
        molhada: stats.molhada,
        notaCount: stats.notas.size
      }));

    const carriers = Object.entries(transpCounts)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 3)
      .map(([name, stats]) => ({ 
        name: name === "—" || !name ? "NÃO INFORMADO" : name, 
        value: stats.total,
        molhada: stats.molhada,
        notaCount: stats.notas.size
      }));

    return { products, carriers, maxDay, totalNotas: allNotas.size };
  }, [filteredRegistros, chartData, baseCodigos]);

  const toggleDay = (dateStr: string) => {
    setExpandedDay(prev => prev === dateStr ? null : dateStr);
  };

  return (
    <div className="flex flex-col h-full w-full min-w-full text-slate-900 dark:text-slate-200 font-sans">
      
      {/* HEADER SECTION - Matches RegistrosTab */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 w-full">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="p-1">
              <Droplet className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight uppercase tracking-tight">RELATÓRIO DE RECEBIMENTO</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-blue-600 text-white">
                  MENSAL
                </span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  FLUXO DE AVARIAS
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-transparent month-nav-container">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white no-print"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 py-1 text-sm font-bold text-slate-900 dark:text-slate-300 min-w-[140px] text-center uppercase tracking-widest">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white no-print"
            >
              <ChevronRight size={18} />
            </button>
          </div>

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
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsTranspDropdownOpen(false)}
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-40 overflow-hidden backdrop-blur-xl"
                  >
                    <div className="p-2 flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                      <button
                        onClick={() => {
                          setSelectedTransportadora("all");
                          setIsTranspDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                          selectedTransportadora === "all"
                            ? "bg-blue-600 text-white"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                      >
                        TODAS TRANSPORTADORAS
                      </button>
                      {transportadoras.map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            setSelectedTransportadora(t);
                            setIsTranspDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                            selectedTransportadora === t
                              ? "bg-blue-600 text-white"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => setHideEmptyDays(!hideEmptyDays)}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300",
              hideEmptyDays 
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-300"
            )}
          >
            {hideEmptyDays ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>

          <div className="relative w-full md:w-auto group search-bar-container no-print">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 transition-colors group-focus-within:text-blue-500" size={16} />
            <input 
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-48 rounded-2xl border border-transparent bg-white dark:bg-slate-900 py-2 pl-11 pr-5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-blue-500/20 transition-all font-medium"
            />
          </div>
        </div>
      </div>

      {/* CONTENT LAYOUT */}
      <div className="flex flex-1 gap-6 overflow-hidden w-full">
        {/* SIDE PANEL SECTION - Analytics Dashboard (Fixed on Left) */}
        <div className="w-[450px] flex-none bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border-none flex flex-col gap-8 overflow-y-auto custom-scrollbar">
          
          {/* Main Distribution Donut */}
          <section className="flex flex-col gap-8">
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">Distribuição de Avarias</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Comparativo Mensal</p>
            </div>

            <div className="flex-none flex flex-col items-center justify-center relative min-h-[160px] w-full my-1">
              {donutData.length > 0 ? (
                <div className="relative w-full flex justify-center items-center outline-none">
                  <PieChart width={140} height={140} style={{ outline: "none" }}>
                    <Pie
                      data={donutData}
                      cx={70}
                      cy={70}
                      innerRadius={48}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                      isAnimationActive={false}
                      tabIndex={-1}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: "none" }} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "#0f172a", 
                        border: "none", 
                        borderRadius: "12px",
                        fontSize: "10px",
                        color: "#fff"
                      }}
                    />
                  </PieChart>
                  
                  {/* Center Label */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-20">
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-[0.2em]">Total</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white leading-none">
                      {donutData.reduce((acc, curr) => acc + curr.value, 0)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-slate-300 dark:text-slate-700">
                  <Package size={48} strokeWidth={1} />
                  <p className="text-[10px] uppercase tracking-widest mt-4 font-bold">Sem dados</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              {donutData.map((item, idx) => (
                <div key={idx} className="bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-xl border border-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{item.name}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-slate-900 dark:text-white leading-none">{item.value}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      {((item.value / donutData.reduce((acc, curr) => acc + curr.value, 0)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Trend Section (Fluxo de Avarias) */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Fluxo Diário</h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-blue-500 uppercase">Pico: {topStats.maxDay.value}</span>
              </div>
            </div>
            
            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAvarias" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415520" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "8px", fontSize: "10px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="avarias" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorAvarias)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Top Performance - Products & Carriers */}
          <div className="grid grid-cols-1 gap-8">
            {/* Top Products */}
            <section className="flex flex-col gap-4">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Top Produtos Afetados</h3>
              <div className="space-y-3">
                {topStats.products.map((p, i) => (
                  <div key={i} className="relative flex flex-col gap-1 group">
                    <div className="flex items-center justify-between z-10">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-blue-500/50 w-4">{i + 1}</span>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{p.name}</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{p.description}</span>
                        </div>
                      </div>
                    <div className="flex flex-col items-end z-10">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white leading-none">{p.value}</span>
                      <div className="flex items-center gap-2 mt-1">
                        {p.molhada > 0 && (
                          <span className="text-[9px] font-bold text-blue-500 flex items-center gap-0.5 mt-0.5">
                            <Droplet size={8} fill="currentColor" />
                            {p.molhada}
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                          <FileText size={8} />
                          {p.notaCount}
                        </span>
                      </div>
                    </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="absolute -left-2 -right-2 top-0 bottom-0 bg-blue-500/5 rounded-lg -z-0 transition-all group-hover:bg-blue-500/10" 
                         style={{ width: `${(p.value / (topStats.products[0]?.value || 1)) * 100}%` }} />
                  </div>
                ))}
              </div>
            </section>

            {/* Top Carriers */}
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
                          <span className="text-[9px] font-bold text-blue-500 flex items-center gap-0.5 mt-0.5">
                            <Droplet size={8} fill="currentColor" />
                            {c.molhada}
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                          <FileText size={8} />
                          {c.notaCount}
                        </span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="absolute left-0 top-0 bottom-0 bg-slate-500/5 dark:bg-blue-500/5 rounded-md -z-0 transition-all group-hover:bg-blue-500/10" 
                         style={{ width: `${(c.value / (topStats.carriers[0]?.value || 1)) * 100}%` }} />
                  </div>
                ))}
              </div>
            </section>
          </div>

        {/* Quick Summary Footer */}
        <div className="mt-auto bg-blue-600 dark:bg-blue-600/10 p-4 rounded-2xl flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-blue-100 dark:text-blue-400 uppercase tracking-widest">Total de Notas</span>
            <span className="text-lg font-black text-white dark:text-blue-400">{topStats.totalNotas}</span>
          </div>
          <div className="flex flex-col items-center border-l border-white/20 dark:border-blue-400/20 pl-4">
            <span className="text-[9px] font-bold text-blue-100 dark:text-blue-400 uppercase tracking-widest">Média Diária</span>
            <span className="text-lg font-black text-white dark:text-blue-400">
              {(() => {
                const totalEntrada = filteredRegistros.reduce((acc, curr) => acc + (curr.Entrada || 0), 0);
                const daysWithAvarias = chartData.filter(d => d.avarias > 0).length || 1;
                return (totalEntrada / daysWithAvarias).toFixed(1);
              })()}
            </span>
          </div>
          <div className="flex flex-col items-end border-l border-white/20 dark:border-blue-400/20 pl-4">
            <span className="text-[9px] font-bold text-blue-100 dark:text-blue-400 uppercase tracking-widest">Dia Crítico</span>
            <span className="text-lg font-black text-white dark:text-blue-400 uppercase">{topStats.maxDay.date}</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Table SECTION */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* TABLE SECTION */}
        <div className="flex-1 overflow-x-auto overflow-y-auto border-none bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm rounded-2xl shadow-none custom-scrollbar relative mx-6 print:mx-0 print:overflow-visible">
        <table className="w-full text-left border-none border-collapse text-sm whitespace-nowrap min-w-[1000px]">
          <thead className="sticky top-0 z-20 bg-slate-100/80 dark:bg-slate-900/80 border-none backdrop-blur-md">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-[150px]">Data</th>
              <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-full">Resumo Operacional</th>
              <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400 w-[180px] text-center uppercase tracking-widest text-[10px]">Avarias</th>
              <th className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400 w-[180px] text-center uppercase tracking-widest text-[10px]">Total Molhado</th>
              <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-[100px] text-center">Ação</th>
            </tr>
          </thead>
          <tbody className="border-none">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando registros...</p>
                  </div>
                </td>
              </tr>
            ) : filteredDays.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhum registro encontrado neste mês</p>
                </td>
              </tr>
            ) : (
              filteredDays.map((day, idx) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const items = groupedByDay[dateStr] || [];
                const isExpanded = expandedDay === dateStr;
                const hasItems = items.length > 0;
                const totalEntrada = items.reduce((acc, curr) => acc + (curr.Entrada || 0), 0);
                const totalMolhada = items.reduce((acc, curr) => acc + (curr["Quantidade Molhada"] || 0), 0);
                
                return (
                  <React.Fragment key={dateStr}>
                    {/* Main Row (Day) */}
                    <tr 
                      onClick={() => hasItems && toggleDay(dateStr)}
                        className={cn(
                          "transition-all group relative z-0 border-none",
                          hasItems ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:z-10" : "opacity-50 grayscale cursor-default",
                          isExpanded && "bg-slate-50 dark:bg-slate-800/80"
                        )}
                    >
                      <td className="px-5 py-3.5 text-sm font-mono text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-100 transition-colors">
                        {format(day, "dd/MM/yyyy")}
                      </td>
                      <td className="px-5 py-3.5">
                        {hasItems ? (
                          <div className="flex items-center gap-3">
                            <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                              {format(day, "EEEE", { locale: ptBR })}
                            </span>
                            {totalMolhada > 0 && (
                              <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5 uppercase tracking-[0.1em] shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                                <Droplet size={10} fill="currentColor" className="animate-pulse" /> Alerta: Avaria Molhada
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[12px] text-slate-400 italic">Sem movimentação</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={cn(
                          "font-bold font-mono text-sm",
                          hasItems ? "text-slate-700 dark:text-slate-200" : "text-slate-400"
                        )}>
                          {hasItems ? totalEntrada : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {totalMolhada > 0 ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-transparent">
                            <Droplet size={12} className="text-blue-600 dark:text-blue-400 animate-pulse" />
                            <span className="font-black font-mono text-sm text-blue-600 dark:text-blue-400">
                              {totalMolhada}
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold font-mono text-sm text-slate-300 dark:text-slate-700">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {hasItems && (
                          <ChevronDown 
                            size={18} 
                            className={cn(
                              "text-slate-400 transition-transform duration-300",
                              isExpanded && "rotate-180 text-blue-500"
                            )} 
                          />
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded Content (Details Table inside a row) */}
                    <AnimatePresence>
                      {isExpanded && hasItems && (
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="bg-slate-50/30 dark:bg-slate-900/40 relative z-0"
                        >
                          <td colSpan={5} className="p-0 border-none">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: "auto" }}
                              exit={{ height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              <div className="w-full bg-transparent">
                                  <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 border-none">
                                      <tr>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[120px]">Nota Fiscal</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Produto</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Descrição</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px]">Entrada</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest w-[90px]">Qtd Molh.</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Transportadora</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Placa</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Container</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Lacre</th>
                                      </tr>
                                    </thead>
                                    <tbody className="border-none">
                                      {(() => {
                                        // Group items by NF for this day
                                        const groupedByNF: Record<string, RegistroRecebimento[]> = {};
                                        items.forEach(item => {
                                          const nf = item.nota_fiscal?.toString() || "S/N";
                                          if (!groupedByNF[nf]) groupedByNF[nf] = [];
                                          groupedByNF[nf].push(item);
                                        });

                                        return Object.entries(groupedByNF).map(([nf, nfItems]) => {
                                          const isMulti = nfItems.length > 1;
                                          const isNFExpanded = expandedNFs[`${dateStr}-${nf}`];
                                          const totalEntradaNF = nfItems.reduce((acc, curr) => acc + (curr.Entrada || 0), 0);
                                          const totalMolhadaNF = nfItems.reduce((acc, curr) => acc + (curr["Quantidade Molhada"] || 0), 0);
                                          
                                          return (
                                            <React.Fragment key={nf}>
                                              {/* Main NF Row / Summary Row */}
                                              <tr 
                                                className={cn(
                                                  "transition-colors group border-b border-slate-200/60 dark:border-slate-800/40",
                                                  isMulti ? "cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-500/5" : "hover:bg-slate-100/50 dark:hover:bg-slate-800/60"
                                                )}
                                                onClick={() => {
                                                  if (isMulti) {
                                                    setExpandedNFs(prev => ({
                                                      ...prev,
                                                      [`${dateStr}-${nf}`]: !prev[`${dateStr}-${nf}`]
                                                    }));
                                                  }
                                                }}
                                              >
                                                {/* 1. Nota Fiscal */}
                                                <td className="px-5 py-3.5 text-sm font-mono font-bold text-slate-700 dark:text-slate-200">
                                                  <div className="flex items-center gap-2">
                                                    {nf}
                                                    {isMulti && (
                                                      <ChevronDown 
                                                        size={14} 
                                                        className={cn(
                                                          "text-blue-500 transition-transform duration-200",
                                                          isNFExpanded && "rotate-180"
                                                        )} 
                                                      />
                                                    )}
                                                  </div>
                                                </td>

                                                {/* 2. Produto */}
                                                <td className="px-5 py-3.5 text-sm font-mono text-slate-600 dark:text-slate-400">
                                                  {isMulti ? (
                                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter bg-blue-500/10 px-1.5 py-0.5 rounded-sm">
                                                      Múltiplos Itens ({nfItems.length})
                                                    </span>
                                                  ) : (
                                                    nfItems[0].Produto
                                                  )}
                                                </td>

                                                {/* 3. Descrição */}
                                                <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                                  {isMulti ? "—" : (baseCodigos[nfItems[0].Produto] || "—")}
                                                </td>

                                                {/* 4. Entrada */}
                                                <td className="px-5 py-3.5 text-sm font-mono text-slate-700 dark:text-slate-300">
                                                  {isMulti ? totalEntradaNF : nfItems[0].Entrada || 0}
                                                </td>

                                                {/* 5. Qtd Molhada */}
                                                <td className="px-5 py-3.5 text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                                                  {isMulti ? (totalMolhadaNF > 0 ? totalMolhadaNF : "—") : ((nfItems[0]["Quantidade Molhada"] || 0) > 0 ? nfItems[0]["Quantidade Molhada"] : "—")}
                                                </td>

                                                {/* 6. Transportadora */}
                                                <td className="px-5 py-3.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                                                  {nfItems[0].transportadora || "—"}
                                                </td>

                                                {/* 7. Placa */}
                                                <td className="px-5 py-3.5 text-xs font-mono uppercase text-slate-500 dark:text-slate-400">
                                                  {nfItems[0].placa || "—"}
                                                </td>

                                                {/* 8. Container */}
                                                <td className="px-5 py-3.5 text-xs font-mono uppercase text-slate-500 dark:text-slate-400">
                                                  {nfItems[0].container || "—"}
                                                </td>

                                                {/* 9. Lacre */}
                                                <td className="px-5 py-3.5 text-xs font-mono uppercase text-slate-500 dark:text-slate-400">
                                                  {nfItems[0].lacre || "—"}
                                                </td>
                                              </tr>

                                              {/* Expanded Individual Items for this NF */}
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
                                                    <td className="px-5 py-2.5 text-sm font-mono text-slate-700 dark:text-slate-300 font-bold">
                                                      {item.Produto}
                                                    </td>
                                                    <td className="px-5 py-2.5 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                                      {baseCodigos[item.Produto] || "—"}
                                                    </td>
                                                    <td className="px-5 py-2.5 text-sm font-mono text-slate-700 dark:text-slate-300">
                                                      {item.Entrada || 0}
                                                    </td>
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
                              </div>
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

      {/* Style block moved to useEffect for better parsing safety */}
    </div>
  </div>
  );
});
