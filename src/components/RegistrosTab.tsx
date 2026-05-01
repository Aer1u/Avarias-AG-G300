import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Save, 
  Trash2, 
  Search, 
  Calendar, 
  ArrowLeft, 
  ArrowRight,
  Filter,
  Check,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info as InfoIcon } from 'lucide-react';

interface Registro {
  id?: number;
  Data: string;
  Produto: string;
  Entrada: number | null;
  Saída: number | null;
  Origem: string;
  Observação: string;
  transportadora?: string | null;
  nota_fiscal?: number | null;
  placa?: string | null;
  container?: string | null;
  lacre?: string | null;
  'Movimentação Sistema'?: boolean | null;
  Molhado?: boolean;
  qtd_molhada?: number | null;
  isNew?: boolean;
  isDirty?: boolean;
}

interface HistoricoDriveIn {
  id: number;
  created_at: string;
  usuario: string;
  tipo_acao: string;
  sku: string;
  posicao: string;
  nivel_origem: number | null;
  prof_origem: number | null;
  nivel_destino: number | null;
  prof_destino: number | null;
  quantidade: number;
}

const ORIGEM_OPTIONS = [
  'Ajuste',
  'Retrabalho',
  'Uso Interno',
  'Armazenamento',
  'Expedição',
  'Recebimento'
];

interface RegistrosTabProps {
  onRefresh?: () => void;
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

const CustomSelect = ({ value, options, onChange, disabled, placeholder = "Selecione..." }: { value: string, options: string[], onChange: (v: string) => void, disabled: boolean, placeholder?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full text-left bg-transparent border-none px-5 py-3.5 text-sm transition-colors focus:outline-none flex items-center justify-between",
          disabled ? "cursor-default text-slate-400 dark:text-slate-600" : "cursor-pointer text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20"
        )}
      >
        <span className={!value ? "text-slate-400 dark:text-slate-600 truncate" : "truncate"}>{value || placeholder}</span>
        {!disabled && <ChevronDown className={cn("w-4 h-4 ml-2 flex-shrink-0 transition-transform text-slate-400", isOpen && "rotate-180")} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[60] w-[180px] top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden py-1"
          >
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm transition-colors",
                  value === opt 
                    ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/30" 
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                )}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Toast: React.FC<ToastState & { onClose: () => void }> = ({ show, message, type, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-8 right-8 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md border"
          style={{
            backgroundColor: type === 'success' ? 'rgba(16, 185, 129, 0.15)' : type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            borderColor: type === 'success' ? 'rgba(16, 185, 129, 0.3)' : type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)',
            color: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'
          }}
        >
          {type === 'success' && <CheckCircle2 size={20} />}
          {type === 'error' && <AlertCircle size={20} />}
          {type === 'info' && <InfoIcon size={20} />}
          <span className="text-sm font-bold tracking-tight">{message}</span>
          <button onClick={onClose} className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors">
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const RegistrosTab: React.FC<RegistrosTabProps> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [historicoDriveIn, setHistoricoDriveIn] = useState<HistoricoDriveIn[]>([]);
  const [viewMode, setViewMode] = useState<'geral' | 'drivein'>('geral');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });
  const [obsModalTarget, setObsModalTarget] = useState<{ index: number, isNew: boolean, value: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
  };
  
  // Date filtering
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = useMemo(() => endOfWeek(currentWeekStart, { weekStartsOn: 1 }), [currentWeekStart]);

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('Registros')
        .select('*')
        .gte('Data', startDate)
        .lte('Data', endDate)
        .order('Data', { ascending: false });

      if (error) throw error;
      setRegistros(data || []);
    } catch (err) {
      console.error('Erro ao buscar registros:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricoDriveIn = async () => {
    setLoading(true);
    try {
      const startDate = format(currentWeekStart, 'yyyy-MM-dd') + 'T00:00:00Z';
      const endDate = format(addDays(weekEnd, 1), 'yyyy-MM-dd') + 'T00:00:00Z'; // add 1 day to include end of week fully

      const { data, error } = await supabase
        .from('historico_mapeamento')
        .select('*')
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erro do Supabase ao buscar historico:', error);
        setToast({ show: true, message: `Erro ao carregar histórico: ${error.message}`, type: 'error' });
        return;
      }
      setHistoricoDriveIn(data || []);
    } catch (err: any) {
      console.warn('Erro de código ao buscar historico:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'geral') {
      fetchRegistros();
    } else {
      fetchHistoricoDriveIn();
    }
  }, [currentWeekStart, viewMode]);

  const handleAddRow = () => {
    const newRow: Registro = {
      Data: format(new Date(), 'yyyy-MM-dd'),
      Produto: '',
      Entrada: null,
      Saída: null,
      Origem: '',
      Observação: '',
      'Movimentação Sistema': false,
      Molhado: false,
      isNew: true,
      isDirty: true
    };
    setRegistros([newRow, ...registros]);
  };
  
  const removeRow = (index: number) => {
    const newRegistros = registros.filter((_, i) => i !== index);
    setRegistros(newRegistros);
  };

  const updateRow = (index: number, field: keyof Registro, value: any) => {
    const newRegistros = [...registros];
    let finalValue = value;
    
    // Auto-adjust date if field is Data
    if (field === 'Data' && typeof value === 'string') {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      // Handle "DD" -> Today's Month/Year
      if (/^\d{1,2}$/.test(value)) {
        finalValue = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${value.padStart(2, '0')}`;
      }
      // Handle "DD/MM" -> Current Year
      else if (/^\d{1,2}\/\d{1,2}$/.test(value)) {
        const [d, m] = value.split('/');
        finalValue = `${currentYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      // Handle "DD/MM/YY" -> 20YY
      else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(value)) {
        const [d, m, y] = value.split('/');
        finalValue = `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      // Handle "DD/MM/YYYY" -> YYYY-MM-DD
      else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
        const [d, m, y] = value.split('/');
        finalValue = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

    // Integer only validation for Entrada/Saída
    if ((field === 'Entrada' || field === 'Saída')) {
      if (value === '' || value === null) {
        finalValue = null;
      } else {
        const parsed = parseInt(value.toString().replace(/[^0-9]/g, ''), 10);
        finalValue = isNaN(parsed) ? null : parsed;
      }
    }

    newRegistros[index] = { 
      ...newRegistros[index], 
      [field]: finalValue,
      isDirty: true 
    };
    setRegistros(newRegistros);
  };

  const handleSaveRows = async () => {
    const rowsToSave = registros.filter(r => r.isDirty);
    if (rowsToSave.length === 0) return;

    // Validação obrigatória da origem
    const invalids = rowsToSave.filter(r => r.isNew && (!r.Origem || r.Origem.trim() === ''));
    if (invalids.length > 0) {
      setToast({ show: true, message: 'Atenção: A coluna ORIGEM é obrigatória para salvar novos registros!', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      for (const row of rowsToSave) {
        const cleanRow: any = {
          Data: row.Data,
          Produto: row.Produto,
          Entrada: row.Entrada,
          Saída: row.Saída,
          Origem: row.Origem,
          'Quantidade Molhada': row.qtd_molhada,
          transportadora: row.transportadora,
          nota_fiscal: row.nota_fiscal,
          placa: row.placa,
          container: row.container,
          lacre: row.lacre,
          Observação: row.Molhado && !row.Observação?.includes('[MOLHADO]') ? `[MOLHADO] ${row.Observação || ''}`.trim() : row.Observação,
          'Movimentação Sistema': row['Movimentação Sistema']
        };
        
        if (!cleanRow.Data || !cleanRow.Produto) continue;

        // ── LOGIC FOR NEW REGISTRATIONS ──
        if (row.isNew) {
          // A. If it's a SAÍDA (Exit), validate floor stock first
          if (row.Saída && row.Saída > 0) {
            const { data: floorStock, error: stockErr } = await supabase
              .from('mapeamento')
              .select('id, Quantidade')
              .eq('Posição', 'Chão')
              .eq('Código', row.Produto)
              .order('id', { ascending: true });

            if (stockErr) throw stockErr;

            const totalFloor = (floorStock || []).reduce((acc, curr) => acc + (curr.Quantidade || 0), 0);
            
            if (totalFloor < row.Saída) {
              throw new Error(`Estoque insuficiente no CHÃO para ${row.Produto}. Disponível: ${totalFloor}`);
            }

            // B. Consume floor stock
            let remainingToConsume = row.Saída;
            for (const pallet of (floorStock || [])) {
              if (remainingToConsume <= 0) break;

              const palletQty = pallet.Quantidade || 0;
              if (palletQty <= remainingToConsume) {
                // Delete pallet record
                const { error: delErr } = await supabase.from('mapeamento').delete().eq('id', pallet.id);
                if (delErr) throw delErr;
                remainingToConsume -= palletQty;
              } else {
                // Reduce pallet quantity
                const { error: updErr } = await supabase.from('mapeamento').update({ Quantidade: palletQty - remainingToConsume }).eq('id', pallet.id);
                if (updErr) throw updErr;
                remainingToConsume = 0;
              }
            }
          }

          // C. If it's an ENTRADA (Entry), create a new floor pallet
          if (row.Entrada && row.Entrada > 0) {
            const { error: floorErr } = await supabase.from('mapeamento').insert([
              {
                'Posição': 'Chão',
                'Código': row.Produto,
                'Quantidade': row.Entrada,
                'Nível': 0,
                'Profundidade': 1,
                'Parte Tombada': 0,
                'Parte Molhada': row.Molhado ? row.Entrada : 0
              }
            ]);
            if (floorErr) throw floorErr;
          }

          // D. Finally, save the registration record
          const { error } = await supabase.from('Registros').insert([cleanRow]);
          if (error) throw error;

        } else if (row.id) {
          // Logic for existing row updates (Movement records themselves remain mostly immutable as per previous rules)
          const { error } = await supabase.from('Registros').update(cleanRow).eq('id', row.id);
          if (error) throw error;
        }
      }
      
      await fetchRegistros();
      if (onRefresh) onRefresh();
      
      showToast('Registros salvos e estoque atualizado!', 'success');
    } catch (err: any) {
      console.error('Erro ao salvar registros:', JSON.stringify(err, null, 2), err);
      const errorMsg = err?.message || err?.details || 'Erro desconhecido ao salvar';
      showToast(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredRegistros = registros.filter(r => 
    r.Produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.Observação?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.Origem?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistorico = historicoDriveIn.filter(r => 
    r.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.posicao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.usuario?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full text-slate-900 dark:text-slate-200 font-sans">
      {/* Header / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/10 dark:bg-blue-600/20 p-2 rounded-xl border border-blue-500/10 dark:border-blue-500/20">
            <Calendar className="text-blue-600 dark:text-blue-400" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight">Registros e Histórico</h2>
            <div className="flex items-center gap-2 mt-1">
              <button 
                onClick={() => setViewMode('geral')}
                className={cn("text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all", viewMode === 'geral' ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800")}
              >
                Entradas e Saídas
              </button>
              <button 
                onClick={() => setViewMode('drivein')}
                className={cn("text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all", viewMode === 'drivein' ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800")}
              >
                Drive-In Mapeamento
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="px-3 py-1 text-sm font-bold text-slate-900 dark:text-slate-300 min-w-[200px] text-center">
            {format(currentWeekStart, "dd 'de' MMM", { locale: ptBR })} - {format(weekEnd, "dd 'de' MMM", { locale: ptBR })}
          </div>

          <button 
            onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
            className="p-1.5 hover:bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white"
          >
            <ChevronRight size={18} />
          </button>
          
          <button 
            onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="mx-1 px-3 py-1 text-[10px] font-black uppercase bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-md hover:bg-blue-600/20 transition-all"
          >
            Hoje
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text"
              placeholder="Buscar por produto ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-transparent rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-64 transition-all"
            />
          </div>

          {viewMode === 'geral' && (
            <>
              <button 
                onClick={handleAddRow}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
              >
                <Plus size={18} />
                Novo Registro
              </button>

              <button 
                onClick={handleSaveRows}
                disabled={saving || !registros.some(r => r.isDirty)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95",
                  registros.some(r => r.isDirty)
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                )}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar Registros
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto border-none bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm rounded-2xl overflow-hidden shadow-none custom-scrollbar relative">
        {viewMode === 'geral' ? (
          <table className="w-full text-left min-w-[1400px] border-none">
            <thead className="sticky top-0 z-20 bg-slate-100/80 dark:bg-slate-900/80 border-none">
              <tr>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Data</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Produto</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px]">Entrada</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px]">Saída</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[90px]">Qtd Molh.</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Origem</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Transportadora</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[100px]">NF</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Placa</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Container</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Lacre</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px] text-center">Sistema</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px] text-center">Obsv.</th>
              </tr>
            </thead>
            <tbody className="border-none">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-blue-500" size={32} />
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando registros...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhum registro encontrado nesta semana</p>
                  </td>
                </tr>
              ) : (
                filteredRegistros.map((row, idx) => (
                  <tr 
                    key={row.id || `new-${idx}`} 
                    className={cn(
                      "hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group relative z-0 hover:z-10 border-none",
                      row.isDirty && "bg-blue-50/30 dark:bg-blue-500/5",
                      row.isNew && "bg-emerald-50/30 dark:bg-emerald-500/5"
                    )}
                  >
                    <td className="p-0">
                      {row.isNew ? (
                        <input 
                          type="date"
                          value={row.Data ?? ''}
                          onChange={(e) => updateRow(idx, 'Data', e.target.value)}
                          className="w-full bg-transparent border-none px-5 py-3.5 text-sm focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all font-mono text-slate-600 dark:text-slate-300 [color-scheme:light] dark:[color-scheme:dark]"
                        />
                      ) : (
                        <div className="px-5 py-3.5 text-sm font-mono text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-100 transition-colors">
                          {row.Data ? (() => {
                             const p = row.Data.split('-');
                             return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : row.Data;
                          })() : '—'}
                        </div>
                      )}
                    </td>
                    <td className="p-0">
                      <input 
                        type="text"
                        value={row.Produto ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'Produto', e.target.value)}
                        placeholder="0000-00"
                        className="w-full bg-transparent border-none px-5 py-3.5 text-sm font-normal tracking-tight text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white disabled:cursor-default placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="text"
                        value={row.Entrada ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'Entrada', e.target.value)}
                        placeholder="0"
                        className={cn(
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm tabular-nums focus:ring-1 focus:outline-none transition-colors font-normal disabled:cursor-default",
                          (Number(row.Entrada) > 0) 
                            ? "text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500/30" 
                            : "text-slate-400 dark:text-slate-600 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-blue-500/20"
                        )}
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="text"
                        value={row.Saída ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'Saída', e.target.value)}
                        placeholder="0"
                        className={cn(
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm tabular-nums focus:ring-1 focus:outline-none transition-colors font-normal disabled:cursor-default",
                          (Number(row.Saída) > 0) 
                            ? "text-rose-600 dark:text-rose-400 focus:ring-rose-500/30" 
                            : "text-slate-400 dark:text-slate-600 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-blue-500/20"
                        )}
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="text"
                        value={row.qtd_molhada ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'qtd_molhada', e.target.value ? Number(e.target.value) : null)}
                        placeholder="0"
                        className={cn(
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm tabular-nums focus:ring-1 focus:outline-none transition-colors font-normal disabled:cursor-default [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          (Number(row.qtd_molhada) > 0) 
                            ? "text-blue-600 dark:text-blue-400 focus:ring-blue-500/30" 
                            : "text-slate-400 dark:text-slate-600 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-blue-500/20"
                        )}
                      />
                    </td>
                    <td className="p-0">
                      <CustomSelect
                        value={row.Origem ?? ''}
                        disabled={!row.isNew}
                        onChange={(v) => updateRow(idx, 'Origem', v)}
                        options={ORIGEM_OPTIONS}
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="text"
                        value={row.transportadora ?? ''}
                        disabled={!row.isNew || row.Origem !== 'Recebimento'}
                        onChange={(e) => updateRow(idx, 'transportadora', e.target.value)}
                        placeholder="---"
                        className={cn(
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm font-normal tracking-tight focus:outline-none transition-colors",
                          !row.isNew 
                            ? "text-slate-800 dark:text-slate-200 cursor-default" 
                            : row.Origem !== 'Recebimento'
                              ? "cursor-not-allowed opacity-50 bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                              : "text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20 group-hover:text-slate-900 dark:group-hover:text-white cursor-text"
                        )}
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="text"
                        value={row.nota_fiscal ?? ''}
                        disabled={!row.isNew || row.Origem !== 'Recebimento'}
                        onChange={(e) => updateRow(idx, 'nota_fiscal', e.target.value ? Number(e.target.value) : null)}
                        placeholder="---"
                        className={cn(
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm tabular-nums focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          !row.isNew 
                            ? "text-slate-800 dark:text-slate-200 cursor-default" 
                            : row.Origem !== 'Recebimento'
                              ? "cursor-not-allowed opacity-50 bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                              : "text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20 cursor-text"
                        )}
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="text"
                        value={row.placa ?? ''}
                        disabled={!row.isNew || row.Origem !== 'Recebimento'}
                        onChange={(e) => updateRow(idx, 'placa', e.target.value)}
                        placeholder="---"
                        className={cn(
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm font-normal tracking-tight focus:outline-none transition-colors",
                          !row.isNew 
                            ? "text-slate-800 dark:text-slate-200 cursor-default" 
                            : row.Origem !== 'Recebimento'
                              ? "cursor-not-allowed opacity-50 bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                              : "text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20 group-hover:text-slate-900 dark:group-hover:text-white cursor-text"
                        )}
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="text"
                        value={row.container ?? ''}
                        disabled={!row.isNew || row.Origem !== 'Recebimento'}
                        onChange={(e) => updateRow(idx, 'container', e.target.value)}
                        placeholder="---"
                        className={cn(
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm font-normal tracking-tight focus:outline-none transition-colors",
                          !row.isNew 
                            ? "text-slate-800 dark:text-slate-200 cursor-default" 
                            : row.Origem !== 'Recebimento'
                              ? "cursor-not-allowed opacity-50 bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                              : "text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20 group-hover:text-slate-900 dark:group-hover:text-white cursor-text"
                        )}
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="text"
                        value={row.lacre ?? ''}
                        disabled={!row.isNew || row.Origem !== 'Recebimento'}
                        onChange={(e) => updateRow(idx, 'lacre', e.target.value)}
                        placeholder="---"
                        className={cn(
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm font-normal tracking-tight focus:outline-none transition-colors",
                          !row.isNew 
                            ? "text-slate-800 dark:text-slate-200 cursor-default" 
                            : row.Origem !== 'Recebimento'
                              ? "cursor-not-allowed opacity-50 bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                              : "text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20 group-hover:text-slate-900 dark:group-hover:text-white cursor-text"
                        )}
                      />
                    </td>

                    <td className="p-0">
                      <div className="flex justify-center items-center h-full py-3.5">
                        <button
                          onClick={() => updateRow(idx, 'Movimentação Sistema', !row['Movimentação Sistema'])}
                          disabled={row['Movimentação Sistema'] === true && !row.isDirty && !row.isNew}
                          className={cn(
                            "w-10 h-5 rounded-full transition-all relative p-1",
                            row['Movimentação Sistema'] ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700",
                            (row['Movimentação Sistema'] === true && !row.isDirty && !row.isNew) ? "opacity-100" : "hover:scale-105 active:scale-95",
                            (row['Movimentação Sistema'] === true && !row.isDirty && !row.isNew) && "cursor-not-allowed"
                          )}
                        >
                          <div className={cn(
                            "w-3 h-3 bg-white rounded-full transition-all flex items-center justify-center shadow-sm",
                            row['Movimentação Sistema'] ? "translate-x-5" : "translate-x-0"
                          )}>
                            {row['Movimentação Sistema'] && <Check size={8} className="text-emerald-600" />}
                          </div>
                        </button>
                      </div>
                    </td>
                    <td className="p-0 relative">
                      <div className="flex items-center justify-center h-full py-3.5 gap-2 px-2">
                        <button
                          onClick={() => {
                            setObsModalTarget({
                              index: idx,
                              isNew: !!row.isNew,
                              value: row.Observação || ''
                            });
                          }}
                          disabled={!row.isNew && !row.Observação}
                          className={cn(
                            "p-1.5 rounded-lg transition-all border",
                            row.Observação 
                              ? "text-blue-500 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20" 
                              : "text-slate-400 dark:text-slate-500 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800",
                            !row.isNew && !row.Observação && "opacity-50 cursor-not-allowed"
                          )}
                          title={row.Observação || "Adicionar observação"}
                        >
                          <MessageSquare size={14} />
                        </button>
                        {row.isNew && (
                          <button 
                            onClick={() => removeRow(idx)}
                            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all border border-transparent hover:border-rose-500/20"
                            title="Remover linha"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left min-w-[700px]">
            <thead className="sticky top-0 z-20 bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[200px]">Data/Hora</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">SKU</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Posição</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px] text-right">Origem</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px] text-right">Destino</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[90px] text-right">Qtd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-blue-500" size={28} />
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Carregando...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredHistorico.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Nenhuma movimentação nesta semana</p>
                  </td>
                </tr>
              ) : (
                filteredHistorico.map((row) => {
                  const badgeCn =
                    row.tipo_acao === 'EDITAR'    ? 'text-indigo-400 border-indigo-800 bg-indigo-950/60' :
                    row.tipo_acao === 'MOVER'     ? 'text-blue-400 border-blue-800 bg-blue-950/60' :
                    row.tipo_acao === 'REMOVER'   ? 'text-rose-400 border-rose-800 bg-rose-950/60' :
                    row.tipo_acao === 'ATUALIZAR' ? 'text-amber-400 border-amber-800 bg-amber-950/60' :
                    'text-slate-400 border-slate-700 bg-slate-800/40';

                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all hover:scale-[1.01] hover:shadow-lg group cursor-pointer relative z-0 hover:z-10">
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-normal text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors font-mono">
                          {format(new Date(row.created_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                        <span className={cn("ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border align-middle", badgeCn)}>
                          {row.tipo_acao}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-normal text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{row.sku}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-normal text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors font-mono">{row.posicao}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-normal text-slate-600 dark:text-slate-300 tabular-nums">
                          {row.nivel_origem !== null ? `${row.nivel_origem}-${row.prof_origem}` : <span className="text-slate-400 dark:text-slate-600">—</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-normal text-slate-600 dark:text-slate-300 tabular-nums">
                          {row.nivel_destino !== null ? `${row.nivel_destino}-${row.prof_destino}` : <span className="text-slate-400 dark:text-slate-600">—</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-normal text-slate-800 dark:text-slate-200 tabular-nums">{row.quantidade}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">
        {viewMode === 'geral' ? (
          <>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{filteredRegistros.reduce((acc, curr) => acc + (curr.Entrada || 0), 0)} Entradas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span>{filteredRegistros.reduce((acc, curr) => acc + (curr.Saída || 0), 0)} Saídas</span>
              </div>
            </div>
            <p>{filteredRegistros.length} registros exibidos</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Drive-In</span>
              </div>
            </div>
            <p>{filteredHistorico.length} movimentações exibidas</p>
          </>
        )}
      </div>

      <AnimatePresence>
        {obsModalTarget && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <MessageSquare size={16} className="text-blue-500" />
                  Observação
                </h3>
                <button 
                  onClick={() => setObsModalTarget(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="p-5 flex-1">
                {obsModalTarget.isNew ? (
                  <textarea
                    autoFocus
                    value={obsModalTarget.value}
                    onChange={(e) => setObsModalTarget(prev => prev ? { ...prev, value: e.target.value } : null)}
                    placeholder="Digite os detalhes sobre este registro..."
                    className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                  />
                ) : (
                  <div className="w-full min-h-24 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {obsModalTarget.value || <span className="text-slate-400 italic">Sem observação.</span>}
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end gap-2">
                <button
                  onClick={() => setObsModalTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  {obsModalTarget.isNew ? 'Cancelar' : 'Fechar'}
                </button>
                {obsModalTarget.isNew && (
                  <button
                    onClick={() => {
                      updateRow(obsModalTarget.index, 'Observação', obsModalTarget.value);
                      setObsModalTarget(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm shadow-blue-500/20"
                  >
                    Salvar
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast 
        {...toast} 
        onClose={() => setToast(prev => ({ ...prev, show: false }))} 
      />
    </div>
  );
};

export default RegistrosTab;
