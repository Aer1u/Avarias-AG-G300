import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronRight
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
  'Movimentação Sistema'?: boolean | null;
  Molhado?: boolean;
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
      console.error('Erro ao salvar registros:', err);
      const errorMsg = err.message || 'Erro desconhecido ao salvar';
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
    <div className="flex flex-col h-full bg-[#0a0f18] text-slate-200 font-sans p-4">
      {/* Header / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-2 rounded-lg">
            <Calendar className="text-blue-400" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">Registros e Histórico</h2>
            <div className="flex items-center gap-2 mt-1">
              <button 
                onClick={() => setViewMode('geral')}
                className={cn("text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all", viewMode === 'geral' ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800")}
              >
                Entradas e Saídas
              </button>
              <button 
                onClick={() => setViewMode('drivein')}
                className={cn("text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all", viewMode === 'drivein' ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800")}
              >
                Drive-In Mapeamento
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
          <button 
            onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="px-3 py-1 text-sm font-bold text-slate-300 min-w-[200px] text-center">
            {format(currentWeekStart, "dd 'de' MMM", { locale: ptBR })} - {format(weekEnd, "dd 'de' MMM", { locale: ptBR })}
          </div>

          <button 
            onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
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
              className="pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-64 transition-all"
            />
          </div>

          {viewMode === 'geral' && (
            <>
              <button 
                onClick={handleAddRow}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
              >
                <Plus size={18} />
                Novo Registro
              </button>

              <button 
                onClick={handleSaveRows}
                disabled={saving || !registros.some(r => r.isDirty)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg",
                  registros.some(r => r.isDirty)
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                )}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar Registros
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto border border-slate-800 rounded-2xl bg-[#0d131f] backdrop-blur-sm custom-scrollbar relative">
        {viewMode === 'geral' ? (
          <table className="w-full border-collapse text-left table-fixed">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#0f172a] border-b border-slate-800">
                <th className="px-2 py-3.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[45px] text-center border-r border-slate-800/50">#</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[140px] border-r border-slate-800/50">Data</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[140px] border-r border-slate-800/50">Produto</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[100px] text-center border-r border-slate-800/50">Entrada</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[100px] text-center border-r border-slate-800/50">Saída</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[180px] border-r border-slate-800/50">Origem</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[100px] text-center border-r border-slate-800/50">Status</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[100px] text-center border-r border-slate-800/50">Sistema</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
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
                      "group transition-all hover:bg-slate-800/40",
                      row.isDirty ? "bg-blue-600/5" : "even:bg-slate-900/20",
                      !row.isNew && "opacity-80"
                    )}
                  >
                    <td className="p-0 border-r border-slate-800/30 text-center">
                      {row.isNew && (
                        <button 
                          onClick={() => removeRow(idx)}
                          className="p-1.5 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                          title="Remover linha"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                    <td className="p-0 border-r border-slate-800/30">
                      <input 
                        type="text"
                        value={row.Data ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'Data', e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="w-full bg-transparent border-none px-4 py-2.5 text-sm focus:bg-slate-800/80 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all font-mono text-slate-400 group-hover:text-slate-200 disabled:cursor-default"
                      />
                    </td>
                    <td className="p-0 border-r border-slate-800/30">
                      <input 
                        type="text"
                        value={row.Produto ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'Produto', e.target.value)}
                        placeholder="0000-00"
                        className="w-full bg-transparent border-none px-4 py-3 text-sm focus:bg-slate-800/80 focus:ring-1 focus:ring-slate-500/30 focus:outline-none transition-all font-semibold tracking-wide text-slate-200 group-hover:text-white disabled:cursor-default"
                      />
                    </td>
                    <td className="p-0 border-r border-slate-800/30">
                      <input 
                        type="text"
                        value={row.Entrada ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'Entrada', e.target.value)}
                        placeholder="0"
                        className="w-full bg-transparent border-none px-4 py-2.5 text-sm text-center focus:bg-emerald-600/10 focus:ring-1 focus:ring-emerald-500/30 focus:outline-none transition-all font-black text-emerald-500/80 group-hover:text-emerald-400 disabled:cursor-default"
                      />
                    </td>
                    <td className="p-0 border-r border-slate-800/30">
                      <input 
                        type="text"
                        value={row.Saída ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'Saída', e.target.value)}
                        placeholder="0"
                        className="w-full bg-transparent border-none px-4 py-2.5 text-sm text-center focus:bg-rose-600/10 focus:ring-1 focus:ring-rose-500/30 focus:outline-none transition-all font-black text-rose-500/80 group-hover:text-rose-400 disabled:cursor-default"
                      />
                    </td>
                    <td className="p-0 border-r border-slate-800/30">
                      <select
                        value={row.Origem ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'Origem', e.target.value)}
                        className="w-full bg-transparent border-none px-4 py-3 text-sm focus:bg-slate-800/80 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all text-slate-400 group-hover:text-slate-200 disabled:cursor-default appearance-none"
                      >
                        <option value="" disabled className="bg-[#0f172a]">Selecione...</option>
                        {ORIGEM_OPTIONS.map(opt => (
                          <option key={opt} value={opt} className="bg-[#0f172a]">{opt}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-0 border-r border-slate-800/30">
                      <div className="flex justify-center items-center h-full py-2">
                        <button
                          onClick={() => updateRow(idx, 'Molhado', !row.Molhado)}
                          disabled={!row.isNew}
                          className={cn(
                            "flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border",
                            row.Molhado 
                              ? "bg-blue-900/40 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                              : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-800",
                            !row.isNew && "cursor-not-allowed opacity-80"
                          )}
                          title="Marcar como molhado"
                        >
                          <span className="relative flex h-2 w-2">
                            {row.Molhado && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>}
                            <span className={cn("relative inline-flex rounded-full h-2 w-2", row.Molhado ? "bg-blue-500" : "bg-slate-600")}></span>
                          </span>
                          {row.Molhado ? 'Molhado' : 'Seco'}
                        </button>
                      </div>
                    </td>
                    <td className="p-0 border-r border-slate-800/30">
                      <div className="flex justify-center items-center h-full py-2">
                        <button
                          onClick={() => updateRow(idx, 'Movimentação Sistema', !row['Movimentação Sistema'])}
                          disabled={row['Movimentação Sistema'] === true && !row.isDirty && !row.isNew}
                          className={cn(
                            "w-10 h-5 rounded-full transition-all relative p-1",
                            row['Movimentação Sistema'] ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-slate-800 border border-slate-700",
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
                    <td className="p-0">
                      <input 
                        type="text"
                        value={row.Observação ?? ''}
                        disabled={!row.isNew}
                        onChange={(e) => updateRow(idx, 'Observação', e.target.value)}
                        placeholder="Detalhes do movimento..."
                        className="w-full bg-transparent border-none px-4 py-3 text-sm focus:bg-slate-800/80 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all text-slate-400 group-hover:text-slate-200 disabled:cursor-default"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse text-left table-fixed">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#0f172a] border-b border-slate-800">
                <th className="px-4 py-3.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[160px] border-r border-slate-800/50">Data/Hora</th>
                <th className="px-4 py-3.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[100px] border-r border-slate-800/50">Ação</th>
                <th className="px-4 py-3.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[120px] border-r border-slate-800/50">SKU</th>
                <th className="px-4 py-3.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[120px] border-r border-slate-800/50">Posição</th>
                <th className="px-4 py-3.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[100px] text-center border-r border-slate-800/50">Origem (N-P)</th>
                <th className="px-4 py-3.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[100px] text-center border-r border-slate-800/50">Destino (N-P)</th>
                <th className="px-4 py-3.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[80px] text-center">Qtd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-emerald-500" size={32} />
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando histórico do drive-in...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredHistorico.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhuma movimentação no Drive-In nesta semana</p>
                  </td>
                </tr>
              ) : (
                filteredHistorico.map((row, idx) => (
                  <tr key={row.id} className="group transition-all hover:bg-slate-800/40 even:bg-slate-900/20 opacity-90">
                    <td className="px-4 py-2.5 border-r border-slate-800/30 text-slate-400 font-mono text-xs">
                      {format(new Date(row.created_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-800/30 text-slate-300 text-sm font-bold">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider", 
                        row.tipo_acao === 'MOVER' ? "bg-blue-500/20 text-blue-400" :
                        row.tipo_acao === 'ATUALIZAR' ? "bg-amber-500/20 text-amber-400" :
                        row.tipo_acao === 'REMOVER' ? "bg-rose-500/20 text-rose-400" :
                        "bg-slate-500/20 text-slate-400"
                      )}>
                        {row.tipo_acao}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-800/30 font-black tracking-tight uppercase text-emerald-400/90 text-sm">
                      {row.sku}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-800/30 text-slate-300 text-sm font-mono">
                      {row.posicao}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-800/30 text-slate-400 text-sm text-center">
                      {row.nivel_origem !== null ? `${row.nivel_origem}-${row.prof_origem}` : '-'}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-800/30 text-slate-400 text-sm text-center">
                      {row.nivel_destino !== null ? `${row.nivel_destino}-${row.prof_destino}` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 text-sm text-center font-bold">
                      {row.quantidade}
                    </td>
                  </tr>
                ))
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

      <Toast 
        {...toast} 
        onClose={() => setToast(prev => ({ ...prev, show: false }))} 
      />
    </div>
  );
};

export default RegistrosTab;
