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
  MessageSquare,
  Database,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Info as InfoIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

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
  responsavel?: string | null;
  tipo_avaria?: string | null;
  turno?: number | null;
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
  'Recebimento',
  'PPT',
  'Recusa',
];

const AVARIA_OPTIONS = [
  'Amassado',
  'Molhado',
  'Quebrado',
  'Rasgado',
  'Sem Avaria',
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
      const mappedData = (data || []).map(r => ({
        ...r,
        qtd_molhada: r['Quantidade Molhada']
      }));
      setRegistros(mappedData);
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
      const endDate = format(addDays(weekEnd, 1), 'yyyy-MM-dd') + 'T00:00:00Z';

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
      responsavel: '', 
      tipo_avaria: '',
      turno: null,
      'Movimentação Sistema': false,
      Molhado: false,
      isNew: true,
      isDirty: true,
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
    
    if (field === 'Data' && typeof value === 'string') {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      if (/^\d{1,2}$/.test(value)) {
        finalValue = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${value.padStart(2, '0')}`;
      }
      else if (/^\d{1,2}\/\d{1,2}$/.test(value)) {
        const [d, m] = value.split('/');
        finalValue = `${currentYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(value)) {
        const [d, m, y] = value.split('/');
        finalValue = `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
        const [d, m, y] = value.split('/');
        finalValue = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

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

    const checkValidation = rowsToSave.find(r => 
      r.isNew && (!r.Origem || !r.responsavel || !r.tipo_avaria || r.tipo_avaria === '' || !r.turno || r.turno === 0)
    );

    if (checkValidation) {
      showToast('Atenção: Origem, Responsável, Tipo de Avaria e Turno são obrigatórios!', 'error');
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
          responsavel: row.responsavel,
          tipo_avaria: row.tipo_avaria,
          turno: row.turno,
          'Quantidade Molhada': row.qtd_molhada,
          transportadora: row.transportadora,
          nota_fiscal: row.nota_fiscal,
          placa: row.placa,
          container: row.container,
          lacre: row.lacre,
          Observação: row.Observação,
          'Movimentação Sistema': row['Movimentação Sistema']
        };
        
        if (!cleanRow.Data || !cleanRow.Produto) continue;

        if (row.isNew) {
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

            let remainingToConsume = row.Saída;
            for (const pallet of (floorStock || [])) {
              if (remainingToConsume <= 0) break;

              const palletQty = pallet.Quantidade || 0;
              if (palletQty <= remainingToConsume) {
                const { error: delErr } = await supabase.from('mapeamento').delete().eq('id', pallet.id);
                if (delErr) throw delErr;
                remainingToConsume -= palletQty;
              } else {
                const { error: updErr } = await supabase.from('mapeamento').update({ Quantidade: palletQty - remainingToConsume }).eq('id', pallet.id);
                if (updErr) throw updErr;
                remainingToConsume = 0;
              }
            }
          }

          const { error } = await supabase.from('Registros').insert([cleanRow]);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('Registros').update(cleanRow).eq('id', row.id);
          if (error) throw error;
        }
      }
      showToast('Alterações salvas com sucesso!', 'success');
      fetchRegistros();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      showToast(err.message || 'Erro ao salvar alterações', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (id: number, index: number) => {
    if (!id) {
      removeRow(index);
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este registro permanentemente?')) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('Registros').delete().eq('id', id);
      if (error) throw error;
      showToast('Registro excluído com sucesso!', 'success');
      fetchRegistros();
    } catch (err) {
      console.error('Erro ao excluir:', err);
      showToast('Erro ao excluir registro', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredRegistros = useMemo(() => {
    if (!searchTerm) return registros;
    const lowSearch = searchTerm.toLowerCase();
    return registros.filter(r => 
      (r.Produto || '').toLowerCase().includes(lowSearch) ||
      (r.Origem || '').toLowerCase().includes(lowSearch) ||
      (r.responsavel || '').toLowerCase().includes(lowSearch) ||
      (r.tipo_avaria || '').toLowerCase().includes(lowSearch) ||
      (r.transportadora || '').toLowerCase().includes(lowSearch) ||
      (r.placa || '').toLowerCase().includes(lowSearch)
    );
  }, [registros, searchTerm]);

  const filteredHistorico = useMemo(() => {
    if (!searchTerm) return historicoDriveIn;
    const lowSearch = searchTerm.toLowerCase();
    return historicoDriveIn.filter(h => 
      (h.sku || '').toLowerCase().includes(lowSearch) ||
      (h.posicao || '').toLowerCase().includes(lowSearch) ||
      (h.usuario || '').toLowerCase().includes(lowSearch) ||
      (h.tipo_acao || '').toLowerCase().includes(lowSearch)
    );
  }, [historicoDriveIn, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-transparent p-0">
      <Toast {...toast} onClose={() => setToast({ ...toast, show: false })} />

      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
          <button 
            onClick={() => setViewMode('geral')}
            className={cn(
              "px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              viewMode === 'geral' 
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <Database size={14} />
            Movimentação Geral
          </button>
          <button 
            onClick={() => setViewMode('drivein')}
            className={cn(
              "px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              viewMode === 'drivein' 
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <ArrowRight size={14} />
            Histórico Drive-In
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
            <button 
              onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
              className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-3 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 min-w-[180px] justify-center">
              <Calendar size={14} className="text-blue-500" />
              {format(currentWeekStart, "dd/MM")} — {format(weekEnd, "dd/MM/yyyy")}
            </div>
            <button 
              onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
              className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text"
              placeholder="Buscar..."
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
                Salvar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto border-none bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm rounded-2xl overflow-hidden shadow-none custom-scrollbar relative">
        {viewMode === 'geral' ? (
          <table className="w-full text-left min-w-[1600px] border-none">
            <thead className="sticky top-0 z-20 bg-slate-100/80 dark:bg-slate-900/80 border-none">
              <tr>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Data</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Produto</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[150px]">Responsável</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[150px]">Tipo Avaria</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px]">Turno</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px]">Entrada</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px]">Saída</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[90px]">Qtd Molh.</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Origem</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Transp.</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[100px]">NF</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Placa</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Container</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Lacre</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px] text-center">Sist.</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px] text-center">Obs.</th>
              </tr>
            </thead>
            <tbody className="border-none">
              {loading ? (
                <tr>
                  <td colSpan={16} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-blue-500" size={32} />
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando registros...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-20 text-center">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhum registro encontrado</p>
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
                        value={row.responsavel ?? ''} 
                        disabled={!row.isNew} 
                        onChange={(e) => updateRow(idx, 'responsavel', e.target.value)} 
                        placeholder="---"
                        className="w-full bg-transparent border-none px-5 py-3.5 text-sm focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition-colors text-slate-800 dark:text-slate-200" 
                      />
                    </td>
                    <td className="p-0">
                      <CustomSelect
                        value={row.tipo_avaria ?? ''}
                        disabled={!row.isNew}
                        onChange={(v) => updateRow(idx, 'tipo_avaria', v)}
                        options={AVARIA_OPTIONS}
                        placeholder="Avaria?"
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="number"
                        value={row.turno ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'turno', e.target.value ? Number(e.target.value) : null)}
                        placeholder="---"
                        className={cn(
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm tabular-nums focus:ring-1 focus:outline-none transition-colors font-normal disabled:cursor-default",
                          (Number(row.turno) > 0) 
                            ? "text-blue-600 dark:text-blue-400 focus:ring-blue-500/30" 
                            : "text-rose-500 dark:text-rose-400 placeholder:text-rose-400 dark:placeholder:text-rose-600 focus:ring-rose-500/20"
                        )}
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
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm tabular-nums focus:ring-1 focus:outline-none transition-colors font-normal disabled:cursor-default",
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
                          "w-full bg-transparent border-none px-5 py-3.5 text-sm tabular-nums focus:outline-none transition-colors",
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
                    <td className="p-0 text-center">
                      <button 
                        onClick={() => updateRow(idx, 'Movimentação Sistema', !row['Movimentação Sistema'])}
                        disabled={!row.isNew}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          row['Movimentação Sistema'] 
                            ? "text-emerald-500 bg-emerald-500/10" 
                            : "text-slate-300 dark:text-slate-700 hover:text-slate-400"
                        )}
                      >
                        {row['Movimentação Sistema'] ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      </button>
                    </td>
                    <td className="p-0 text-center">
                      <div className="flex items-center justify-center gap-1 px-2">
                        <button 
                          onClick={() => setObsModalTarget({ index: idx, isNew: !!row.isNew, value: row.Observação || '' })}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            row.Observação 
                              ? "text-blue-500 bg-blue-500/10" 
                              : "text-slate-300 dark:text-slate-700 hover:text-slate-400"
                          )}
                        >
                          <MessageSquare size={18} />
                        </button>
                        {row.isNew && (
                          <button 
                            onClick={() => removeRow(idx)}
                            className="p-2 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {!row.isNew && (
                          <button 
                            onClick={() => handleDeleteRow(row.id!, idx)}
                            className="p-2 text-slate-300 dark:text-slate-700 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
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
          <div className="p-0">
            <table className="w-full text-left min-w-[1000px] border-none">
              <thead className="sticky top-0 z-20 bg-slate-100/80 dark:bg-slate-900/80 border-none">
                <tr>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Data/Hora</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Ação</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">SKU</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Posição</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Origem (N/P)</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Destino (N/P)</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Qtd</th>
                </tr>
              </thead>
              <tbody className="border-none">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando histórico...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredHistorico.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhuma movimentação no Drive-In</p>
                    </td>
                  </tr>
                ) : (
                  filteredHistorico.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all border-none">
                      <td className="px-5 py-4 text-sm font-mono text-slate-500">
                        {format(parseISO(h.created_at), 'dd/MM HH:mm')}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {h.usuario}
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                          h.tipo_acao === 'ENTRADA' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                        )}>
                          {h.tipo_acao}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-blue-600 dark:text-blue-400">
                        {h.sku}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {h.posicao}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {h.nivel_origem !== null ? `${h.nivel_origem}/${h.prof_origem}` : '—'}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {h.nivel_destino !== null ? `${h.nivel_destino}/${h.prof_destino}` : '—'}
                      </td>
                      <td className="px-5 py-4 text-sm font-black text-slate-900 dark:text-white">
                        {h.quantidade}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {obsModalTarget && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                  <MessageSquare size={18} className="text-blue-500" />
                  Observação do Registro
                </h3>
                <button 
                  onClick={() => setObsModalTarget(null)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              <div className="p-6">
                <textarea 
                  autoFocus
                  disabled={!obsModalTarget.isNew}
                  value={obsModalTarget.value}
                  onChange={(e) => setObsModalTarget({ ...obsModalTarget, value: e.target.value })}
                  placeholder="Digite aqui observações relevantes sobre este registro..."
                  className="w-full h-40 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600 disabled:opacity-60"
                />
                <div className="mt-6 flex justify-end gap-3">
                  <button 
                    onClick={() => setObsModalTarget(null)}
                    className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
                  >
                    Fechar
                  </button>
                  {obsModalTarget.isNew && (
                    <button 
                      onClick={() => {
                        updateRow(obsModalTarget.index, 'Observação', obsModalTarget.value);
                        setObsModalTarget(null);
                      }}
                      className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                      Confirmar
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RegistrosTab;
