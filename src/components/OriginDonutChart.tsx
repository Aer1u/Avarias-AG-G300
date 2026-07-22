import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  ChevronRight, 
  PieChart, 
  ArrowLeft, 
  Package, 
  RotateCcw, 
  HelpCircle, 
  Store, 
  Home, 
  Boxes,
  Truck
} from 'lucide-react';

interface DataPoint {
  name: string;
  value: number;
  originalName?: string;
  color?: string;
  isOthers?: boolean;
}

interface OriginDonutChartProps {
  data: any[];
  typeFilter: 'entrada' | 'saída';
}

const TOP_COLORS = ['#3b82f6', '#10b981']; // Blue, Emerald
const OTHERS_COLOR = '#94a3b8'; // Slate 400
const DETAIL_PALETTE = [
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#14b8a6', // Teal
  '#6366f1', // Indigo
];

const getIconForOrigin = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('RETRABALHO')) return <RotateCcw size={14} />;
  if (n.includes('TROCA')) return <Package size={14} />;
  if (n.includes('LOJINHA')) return <Store size={14} />;
  if (n.includes('INTERNO')) return <Home size={14} />;
  if (n.includes('PEÇAS')) return <Boxes size={14} />;
  if (n.includes('TRANSFERENCIA') || n.includes('EXPEDIÇÃO')) return <Truck size={14} />;
  if (n === '-' || n === 'N/I') return <HelpCircle size={14} />;
  return <Package size={14} />;
};

export const OriginDonutChart: React.FC<OriginDonutChartProps> = ({ data, typeFilter }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [view, setView] = useState<'summary' | 'others'>('summary');

  const processedData = useMemo(() => {
    const rawCounts: Record<string, number> = {};
    data.forEach((m: any) => {
      if (m.tipo !== typeFilter) return;

      const origin = String(m.origem || 'N/I').trim();
      const upperOrigin = origin.toUpperCase();
      const lowerOrigin = origin.toLowerCase();
      if (lowerOrigin.includes('ajuste') || lowerOrigin.includes('mapeamento')) return;
      
      rawCounts[upperOrigin] = (rawCounts[upperOrigin] || 0) + (m.movimentacao || 0);
    });

    const sortedEntries = Object.entries(rawCounts)
      .sort(([, a], [, b]) => b - a);

    const totalVal = sortedEntries.reduce((sum, [, val]) => sum + val, 0);

    // Summary View Data
    const top2 = sortedEntries.slice(0, 2).map(([name, value], i) => ({
      name: name.toUpperCase(),
      originalName: name,
      value,
      color: TOP_COLORS[i]
    }));

    const remaining = sortedEntries.slice(2);
    const othersTotal = remaining.reduce((sum, [, val]) => sum + val, 0);

    const summaryItems: DataPoint[] = [...top2];
    if (othersTotal > 0) {
      summaryItems.push({
        name: 'OUTROS',
        value: othersTotal,
        color: OTHERS_COLOR,
        isOthers: true
      });
    }

    // Others View Data
    const othersItems: DataPoint[] = remaining.map(([name, value], i) => ({
      name: name.toUpperCase(),
      originalName: name,
      value,
      color: DETAIL_PALETTE[i % DETAIL_PALETTE.length]
    }));

    return {
      summaryItems: summaryItems.filter(d => d.value > 0),
      othersItems,
      total: totalVal,
      othersTotal
    };
  }, [data, typeFilter]);

  const activeItems = view === 'summary' ? processedData.summaryItems : processedData.othersItems;
  const activeTotal = view === 'summary' ? processedData.total : processedData.othersTotal;

  // SVG parameters - Optimized for balance
  const size = 140;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div className="flex flex-col h-full relative overflow-hidden px-2">
      {/* HEADER / BREADCRUMB */}
      <div className="flex items-center justify-between mb-2 min-h-[20px]">
        <AnimatePresence mode="wait">
          {view === 'others' ? (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => {
                setView('summary');
                setHoveredIndex(null);
              }}
              className="flex items-center gap-1.5 text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] hover:text-blue-400 transition-colors group"
            >
              <ArrowLeft size={10} className="group-hover:-translate-x-0.5 transition-transform" />
              Voltar
            </motion.button>
          ) : (
              <div />
          )}
        </AnimatePresence>
      </div>

      {/* Main Content Area - Compact for better density */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-0 overflow-hidden">
        {activeItems.length > 0 ? (
          <>
            {/* DONUT CHART */}
            <div className="relative shrink-0 flex items-center justify-center" style={{ width: size + 24, height: size + 24 }}>
              {/* Subtle background glow */}
              <div 
                className="absolute inset-0 rounded-full blur-[30px] opacity-[0.08] transition-colors duration-1000"
                style={{ backgroundColor: hoveredIndex !== null ? activeItems[hoveredIndex].color : '#3b82f6' }}
              />

              <div className="relative flex items-center justify-center" style={{ width: size + 20, height: size + 20 }}>
                <svg 
                  width={size + 20} 
                  height={size + 20} 
                  viewBox={`-10 -10 ${size + 20} ${size + 20}`}
                  className="transform -rotate-90 relative z-10 overflow-visible"
                >
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-slate-100 dark:text-slate-800/20"
                  />
                  
                  {activeItems.map((d, i) => {
                    const percentage = d.value / activeTotal;
                    const strokeDasharray = `${percentage * circumference} ${circumference}`;
                    const strokeDashoffset = -currentOffset;
                    currentOffset += percentage * circumference;
                    const isHovered = hoveredIndex === i;

                    return (
                      <motion.circle
                        key={`${view}-${d.name}`}
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke={d.color}
                        strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                        strokeDasharray={strokeDasharray}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ 
                          strokeDashoffset,
                          strokeWidth: isHovered ? strokeWidth + 4 : strokeWidth 
                        }}
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => d.isOthers && setView('others')}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                        className={cn(
                          "transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.05)]",
                          d.isOthers ? "cursor-pointer" : "cursor-default"
                        )}
                      />
                    );
                  })}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none z-20">
                  <AnimatePresence mode="wait">
                    {hoveredIndex !== null ? (
                      <motion.div
                        key="hover-val"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex flex-col items-center"
                      >
                        <span className="text-[22px] font-black text-slate-900 dark:text-white leading-none tracking-tight">
                          {activeItems[hoveredIndex].value}
                        </span>
                        <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mt-0.5">
                          {Math.round((activeItems[hoveredIndex].value / activeTotal) * 100)}%
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="total-val"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center"
                      >
                        <span className="text-[20px] font-black text-slate-900 dark:text-white leading-none tracking-tight">
                          {activeTotal}
                        </span>
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                          TOTAL
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* LEGEND - Spread out to fill space better */}
            <div className="flex-1 flex flex-col gap-1.5 w-full max-h-full overflow-y-auto custom-scrollbar pr-1 relative z-10 py-1">
              {activeItems.map((d, i) => (
                <div 
                  key={d.name}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => d.isOthers && setView('others')}
                  className={cn(
                    "flex items-center justify-between gap-3 p-2 rounded-xl border border-transparent transition-all duration-300",
                    hoveredIndex === i 
                      ? "bg-slate-50 dark:bg-slate-800/80 border-slate-100 dark:border-slate-700/50 scale-[1.01] shadow-sm" 
                      : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                    d.isOthers ? "cursor-pointer group/others" : "cursor-default"
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 shadow-sm" 
                      style={{ backgroundColor: `${d.color}15`, color: d.color }} 
                    >
                      {getIconForOrigin(d.name)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-tight truncate transition-colors",
                        hoveredIndex === i ? "text-slate-900 dark:text-white" : "text-slate-500"
                      )}>
                        {d.name.toLowerCase()}
                      </span>
                      {d.isOthers ? (
                        <span className="text-[7px] font-black text-blue-500/80 uppercase tracking-widest flex items-center gap-0.5 mt-0.5 group-hover/others:text-blue-500 transition-all">
                          Expandir <ChevronRight size={8} />
                        </span>
                      ) : (
                        <div className="h-2" />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-black text-slate-900 dark:text-white tabular-nums">
                        {d.value}
                      </span>
                      <div className="w-[1px] h-2.5 bg-slate-200 dark:bg-slate-700/50" />
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                        {Math.round((d.value / activeTotal) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-40 py-12">
            <PieChart size={40} className="text-slate-300 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Sem dados disponíveis
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
