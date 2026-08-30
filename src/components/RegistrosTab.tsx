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
  Info as InfoIcon,
  Edit2,
  FilterX,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { raw: false });

        if (rows.length === 0) {
          showToast('A planilha importada está vazia.', 'error');
          return;
        }

        const headers = Object.keys(rows[0] || {});

        const getIndex = (aliases: string[]): string | undefined => {
          for (const alias of aliases) {
            const match = headers.find(h => h.trim().toLowerCase() === alias.toLowerCase());
            if (match) return match;
          }
          for (const alias of aliases) {
            const match = headers.find(h => h.trim().toLowerCase().includes(alias.toLowerCase()));
            if (match) return match;
          }
          return undefined;
        };

        const keyData = getIndex(['data chegada', 'entrega', 'data entrega', 'data de chegada', 'data de entrega', 'data', 'recebimento']);
        const keyTransp = getIndex(['transportadora', 'transportador', 'transp', 'transportadora/veiculo']);
        const keyCodigo = getIndex(['código', 'codigo', 'cod', 'sku', 'produto', 'código do produto', 'codigo do produto']);
        const keyAvaria = getIndex(['avaria', 'avarias', 'qtd avaria', 'qtd avarias', 'quantidade avaria', 'quantidade avarias', 'quantidade']);
        const keyLacre = getIndex(['nº lacre', 'no lacre', 'lacre', 'lacre container', 'numero lacre', 'numero do lacre', 'n lacre']);
        const keyPlaca = getIndex(['placa', 'placa veiculo', 'placa do veiculo']);

        if (!keyCodigo || !keyAvaria) {
          showToast('Colunas obrigatórias não encontradas. Certifique-se de incluir CÓDIGO e AVARIA.', 'error');
          return;
        }

        const parseBrDateToIso = (s: string): string => {
          if (!s) return format(new Date(), 'yyyy-MM-dd');
          const str = String(s).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
          
          const parts = str.split(/[\/\-\.]/).filter(Boolean);
          if (parts.length === 3) {
            let [d, m, y] = parts;
            if (y.length === 2) y = `20${y}`;
            const yyyy = parseInt(y, 10);
            const mm = parseInt(m, 10);
            const dd = parseInt(d, 10);
            if (yyyy >= 2000 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
              return `${yyyy}-${mm.toString().padStart(2, '0')}-${dd.toString().padStart(2, '0')}`;
            }
          }
          const excelDate = Number(str);
          if (!isNaN(excelDate) && excelDate > 30000 && excelDate < 60000) {
            const date = new Date((excelDate - 25569) * 86400 * 1000);
            return format(date, 'yyyy-MM-dd');
          }
          return format(new Date(), 'yyyy-MM-dd');
        };

        const newRows: Registro[] = rows.map(r => {
          const rawAvaria = String(r[keyAvaria] || '0').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
          const parsedAvaria = Math.round(Number(rawAvaria) || 0);

          const rawDate = keyData ? (r[keyData] ? String(r[keyData]) : '') : '';
          const finalDate = parseBrDateToIso(rawDate);

          const rawPlaca = keyPlaca && r[keyPlaca] ? String(r[keyPlaca]).toUpperCase().replace(/-/g, '') : '';
          const formattedPlaca = rawPlaca.length > 3 ? rawPlaca.slice(0, 3) + '-' + rawPlaca.slice(3, 7) : rawPlaca;

          return {
            Data: finalDate,
            Produto: keyCodigo ? String(r[keyCodigo] || '').trim() : '',
            Entrada: parsedAvaria > 0 ? parsedAvaria : null,
            Saída: null,
            Origem: 'Recebimento',
            Observação: 'Importado via planilha de Recebimentos',
            transportadora: keyTransp ? String(r[keyTransp] || '').trim().toUpperCase() : '',
            lacre: keyLacre ? String(r[keyLacre] || '').trim().toUpperCase() : '',
            placa: formattedPlaca,
            tipo_avaria: 'Sem Avaria',
            turno: 1,
            'Movimentação Sistema': false,
            Molhado: false,
            isNew: true,
            isDirty: true
          };
        }).filter(item => item.Produto && (item.Entrada && item.Entrada > 0));

        if (newRows.length === 0) {
          showToast('Nenhum recebimento válido com quantidade de avaria > 0 foi encontrado.', 'info');
          return;
        }

        setRegistros(prev => [...newRows, ...prev]);
        showToast(`${newRows.length} recebimentos importados com sucesso! Revise e clique em Salvar.`, 'success');
      } catch (err) {
        console.error('Erro ao ler Excel:', err);
        showToast('Erro ao processar planilha do Excel.', 'error');
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Row Editing State
  const [editingRowIds, setEditingRowIds] = useState<Set<number>>(new Set());

  const toggleEditRow = (id: number) => {
    setEditingRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isRowEditable = (row: Registro) => !!row.isNew || (!!row.id && editingRowIds.has(row.id));

  // Date filtering
  const [dateMode, setDateMode] = useState<'week' | 'custom' | 'all'>('week');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = useMemo(() => endOfWeek(currentWeekStart, { weekStartsOn: 1 }), [currentWeekStart]);
  const [customStartDate, setCustomStartDate] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // Column Filtering
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [colFilters, setColFilters] = useState({
    nota_fiscal: '',
    produto: '',
    origem: '',
    tipo_avaria: '',
    responsavel: '',
    transportadora: '',
    placa: '',
    container: '',
    lacre: '',
    turno: '',
  });

  const clearColumnFilters = () => {
    setColFilters({
      nota_fiscal: '',
      produto: '',
      origem: '',
      tipo_avaria: '',
      responsavel: '',
      transportadora: '',
      placa: '',
      container: '',
      lacre: '',
      turno: '',
    });
  };

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      let query = supabase.from('Registros').select('*');

      if (dateMode === 'week') {
        const startDate = format(currentWeekStart, 'yyyy-MM-dd');
        const endDate = format(weekEnd, 'yyyy-MM-dd');
        query = query.gte('Data', startDate).lte('Data', endDate);
      } else if (dateMode === 'custom') {
        if (customStartDate) query = query.gte('Data', customStartDate);
        if (customEndDate) query = query.lte('Data', customEndDate);
      }

      const { data, error } = await query.order('Data', { ascending: false });

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
      let query = supabase.from('historico_mapeamento').select('*');

      if (dateMode === 'week') {
        const startDate = format(currentWeekStart, 'yyyy-MM-dd') + 'T00:00:00Z';
        const endDate = format(addDays(weekEnd, 1), 'yyyy-MM-dd') + 'T00:00:00Z';
        query = query.gte('created_at', startDate).lt('created_at', endDate);
      } else if (dateMode === 'custom') {
        if (customStartDate) query = query.gte('created_at', customStartDate + 'T00:00:00Z');
        if (customEndDate) query = query.lt('created_at', customEndDate + 'T23:59:59Z');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

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
  }, [currentWeekStart, dateMode, customStartDate, customEndDate, viewMode]);
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
      r.isNew && (!r.Origem || !r.tipo_avaria || r.tipo_avaria === '')
    );

    if (checkValidation) {
      showToast('Atenção: Origem e Tipo de Avaria são obrigatórios!', 'error');
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

          if (row.Entrada && row.Entrada > 0) {
            const { error: mapErr } = await supabase.from('mapeamento').insert([{
              'Posição': 'Chão',
              'Código': row.Produto,
              'Quantidade': row.Entrada,
              'Nível': 0,
              'Profundidade': 0
            }]);
            if (mapErr) throw mapErr;

            await supabase.from('historico_mapeamento').insert([{
              usuario: row.responsavel || 'Sistema',
              tipo_acao: 'ENTRADA',
              sku: row.Produto,
              posicao: 'Chão',
              quantidade: row.Entrada
            }]);
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
    return registros.filter(r => {
      // Global Search
      if (searchTerm) {
        const low = searchTerm.toLowerCase();
        const matchesGlobal = 
          (r.Produto || '').toLowerCase().includes(low) ||
          (r.Origem || '').toLowerCase().includes(low) ||
          (r.responsavel || '').toLowerCase().includes(low) ||
          (r.tipo_avaria || '').toLowerCase().includes(low) ||
          (r.transportadora || '').toLowerCase().includes(low) ||
          (r.placa || '').toLowerCase().includes(low) ||
          (r.container || '').toLowerCase().includes(low) ||
          (r.lacre || '').toLowerCase().includes(low) ||
          (r.Observação || '').toLowerCase().includes(low) ||
          String(r.nota_fiscal || '').toLowerCase().includes(low) ||
          String(r.turno || '').toLowerCase().includes(low) ||
          (r.Data || '').toLowerCase().includes(low) ||
          String(r.Entrada || '').toLowerCase().includes(low) ||
          String(r.Saída || '').toLowerCase().includes(low) ||
          String(r.qtd_molhada || '').toLowerCase().includes(low);

        if (!matchesGlobal) return false;
      }

      // Column Filters
      if (colFilters.nota_fiscal && !String(r.nota_fiscal || '').toLowerCase().includes(colFilters.nota_fiscal.toLowerCase())) return false;
      if (colFilters.produto && !(r.Produto || '').toLowerCase().includes(colFilters.produto.toLowerCase())) return false;
      if (colFilters.origem && (r.Origem || '').toLowerCase() !== colFilters.origem.toLowerCase()) return false;
      if (colFilters.tipo_avaria && (r.tipo_avaria || '').toLowerCase() !== colFilters.tipo_avaria.toLowerCase()) return false;
      if (colFilters.responsavel && !(r.responsavel || '').toLowerCase().includes(colFilters.responsavel.toLowerCase())) return false;
      if (colFilters.transportadora && !(r.transportadora || '').toLowerCase().includes(colFilters.transportadora.toLowerCase())) return false;
      if (colFilters.placa && !(r.placa || '').toLowerCase().includes(colFilters.placa.toLowerCase())) return false;
      if (colFilters.container && !(r.container || '').toLowerCase().includes(colFilters.container.toLowerCase())) return false;
      if (colFilters.lacre && !(r.lacre || '').toLowerCase().includes(colFilters.lacre.toLowerCase())) return false;
      if (colFilters.turno && String(r.turno || '') !== colFilters.turno) return false;

      return true;
    });
  }, [registros, searchTerm, colFilters]);

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

        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Date Filter Bar */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
            <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200/50 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => setDateMode('week')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  dateMode === 'week' 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setDateMode('custom')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  dateMode === 'custom' 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                Período
              </button>
              <button
                type="button"
                onClick={() => setDateMode('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  dateMode === 'all' 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                Tudo
              </button>
            </div>

            {dateMode === 'week' && (
              <div className="flex items-center gap-1">
                <button 
                  type="button"
                  onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500"
                  title="Semana anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="px-2 flex items-center gap-2 text-xs font-normal text-slate-600 dark:text-slate-300 justify-center">
                  <Calendar size={14} className="text-blue-500" />
                  {format(currentWeekStart, "dd/MM")} — {format(weekEnd, "dd/MM/yyyy")}
                </div>
                <button 
                  type="button"
                  onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500"
                  title="Próxima semana"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {dateMode === 'custom' && (
              <div className="flex items-center gap-2 px-2">
                <Calendar size={14} className="text-blue-500" />
                <input 
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                />
                <span className="text-xs text-slate-400 font-bold">até</span>
                <input 
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text"
              placeholder="Buscar por NF, SKU, Placa, Obs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-64 transition-all"
            />
          </div>

          {/* Column Filters Toggle Button */}
          {viewMode === 'geral' && (
            <button
              type="button"
              onClick={() => setShowColumnFilters(!showColumnFilters)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all relative",
                showColumnFilters || Object.values(colFilters).some(Boolean)
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                  : "bg-slate-50 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Filter size={15} />
              <span>Filtros</span>
              {Object.values(colFilters).some(Boolean) && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </button>
          )}

          {viewMode === 'geral' && (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImportExcel} 
                accept=".xlsx,.xls,.csv" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 cursor-pointer"
              >
                <FileText size={18} />
                Importar Recebimentos
              </button>

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

      {/* Column Filters Bar */}
      <AnimatePresence>
        {viewMode === 'geral' && showColumnFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-blue-500" />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Filtros por Coluna
                </span>
              </div>
              {Object.values(colFilters).some(Boolean) && (
                <button
                  type="button"
                  onClick={clearColumnFilters}
                  className="flex items-center gap-1 text-xs font-normal text-rose-500 hover:text-rose-600 transition-colors"
                >
                  <FilterX size={14} />
                  Limpar Filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {/* NF */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Nota Fiscal (NF)</label>
                <input
                  type="text"
                  placeholder="Ex: 5815..."
                  value={colFilters.nota_fiscal}
                  onChange={(e) => setColFilters(prev => ({ ...prev, nota_fiscal: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Produto SKU */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Produto (SKU)</label>
                <input
                  type="text"
                  placeholder="Ex: 9915-02..."
                  value={colFilters.produto}
                  onChange={(e) => setColFilters(prev => ({ ...prev, produto: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Origem */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Origem</label>
                <select
                  value={colFilters.origem}
                  onChange={(e) => setColFilters(prev => ({ ...prev, origem: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Todas</option>
                  {ORIGEM_OPTIONS.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Tipo Avaria */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Tipo Avaria</label>
                <select
                  value={colFilters.tipo_avaria}
                  onChange={(e) => setColFilters(prev => ({ ...prev, tipo_avaria: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Todas</option>
                  {AVARIA_OPTIONS.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* Transportadora */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Transportadora</label>
                <input
                  type="text"
                  placeholder="Ex: ALIANÇA..."
                  value={colFilters.transportadora}
                  onChange={(e) => setColFilters(prev => ({ ...prev, transportadora: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Responsável */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Responsável</label>
                <input
                  type="text"
                  placeholder="Nome..."
                  value={colFilters.responsavel}
                  onChange={(e) => setColFilters(prev => ({ ...prev, responsavel: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Placa */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Placa</label>
                <input
                  type="text"
                  placeholder="Ex: ABC-1234..."
                  value={colFilters.placa}
                  onChange={(e) => setColFilters(prev => ({ ...prev, placa: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Container */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Container</label>
                <input
                  type="text"
                  placeholder="Container..."
                  value={colFilters.container}
                  onChange={(e) => setColFilters(prev => ({ ...prev, container: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Lacre */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Lacre</label>
                <input
                  type="text"
                  placeholder="Lacre..."
                  value={colFilters.lacre}
                  onChange={(e) => setColFilters(prev => ({ ...prev, lacre: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Turno */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Turno</label>
                <select
                  value={colFilters.turno}
                  onChange={(e) => setColFilters(prev => ({ ...prev, turno: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="1">Turno 1</option>
                  <option value="2">Turno 2</option>
                  <option value="3">Turno 3</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-auto border-none bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm rounded-2xl overflow-hidden shadow-none custom-scrollbar relative">
        {viewMode === 'geral' ? (
          <table className="w-full text-left min-w-[1100px] border-none">
            <thead className="sticky top-0 z-20 bg-slate-100/80 dark:bg-slate-900/80 border-none">
              <tr>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Data</th>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[110px]">Produto</th>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[150px]">Tipo Avaria</th>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px]">Turno</th>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px]">Entrada</th>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px]">Saída</th>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[90px]">Qtd Molh.</th>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Origem</th>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[130px]">Transp.</th>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[100px]">NF</th>
                <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest w-[80px] text-center">Obs.</th>
              </tr>
            </thead>
            <tbody className="border-none">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-blue-500" size={32} />
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando registros...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-20 text-center">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhum registro encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredRegistros.map((row, idx) => {
                  const isReceb = row.Origem === 'Recebimento';
                  const transpUpper = (row.transportadora || '').toUpperCase();
                  const showTranspNF = isReceb;
                  const isEditable = isRowEditable(row);
                  
                  return (
                  <tr 
                    key={row.id || `new-${idx}`} 
                    className={cn(
                      "hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group relative z-0 hover:z-10 border-none",
                      row.isDirty && "bg-blue-50/30 dark:bg-blue-500/5",
                      row.isNew && "bg-emerald-50/30 dark:bg-emerald-500/5",
                      row.id && editingRowIds.has(row.id) && "bg-amber-50/30 dark:bg-amber-500/10"
                    )}
                  >
                    <td className="p-0">
                      {isEditable ? (
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
                        disabled={!isEditable}
                        onChange={(e) => updateRow(idx, 'Produto', e.target.value)}
                        placeholder="0000-00"
                        className="w-full bg-transparent border-none px-5 py-3.5 text-sm font-normal tracking-tight text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white disabled:cursor-default placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="p-0">
                      <CustomSelect
                        value={row.tipo_avaria ?? ''}
                        disabled={!isEditable}
                        onChange={(v) => updateRow(idx, 'tipo_avaria', v)}
                        options={AVARIA_OPTIONS}
                        placeholder="Avaria?"
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        type="number"
                        value={row.turno ?? ''}
                        disabled={!isEditable}
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
                        disabled={!isEditable}
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
                        disabled={!isEditable}
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
                        disabled={!isEditable}
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
                        disabled={!isEditable}
                        onChange={(v) => updateRow(idx, 'Origem', v)}
                        options={ORIGEM_OPTIONS}
                      />
                    </td>
                    <td className="p-0">
                      {!showTranspNF ? (
                        <div className="px-5 py-3.5 text-slate-400 dark:text-slate-600 text-sm">---</div>
                      ) : (
                        <input 
                          type="text"
                          value={row.transportadora ?? ''}
                          disabled={!isEditable}
                          onChange={(e) => updateRow(idx, 'transportadora', e.target.value.toUpperCase())}
                          placeholder="---"
                          className={cn(
                            "w-full bg-transparent border-none px-5 py-3.5 text-sm font-normal tracking-tight focus:outline-none transition-colors uppercase",
                            !isEditable 
                              ? "text-slate-800 dark:text-slate-200 cursor-default" 
                              : "text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20 group-hover:text-slate-900 dark:group-hover:text-white cursor-text"
                          )}
                        />
                      )}
                    </td>
                    <td className="p-0">
                      {!showTranspNF ? (
                        <div className="px-5 py-3.5 text-slate-400 dark:text-slate-600 text-sm tabular-nums">---</div>
                      ) : (
                        <input 
                          type="text"
                          value={row.nota_fiscal ?? ''}
                          disabled={!isEditable}
                          onChange={(e) => updateRow(idx, 'nota_fiscal', e.target.value ? Number(e.target.value) : null)}
                          placeholder="---"
                          className={cn(
                            "w-full bg-transparent border-none px-5 py-3.5 text-sm tabular-nums focus:outline-none transition-colors",
                            !isEditable 
                              ? "text-slate-800 dark:text-slate-200 cursor-default" 
                              : "text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20 group-hover:text-slate-900 dark:group-hover:text-white cursor-text"
                          )}
                        />
                      )}
                    </td>
                    <td className="p-0 text-center">
                      <div className="flex items-center justify-center gap-1 px-2">
                        <button 
                          onClick={() => setObsModalTarget({ index: idx, isNew: isEditable, value: row.Observação || '' })}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            row.Observação 
                              ? "text-blue-500 bg-blue-500/10" 
                              : "text-slate-300 dark:text-slate-700 hover:text-slate-400"
                          )}
                        >
                          <MessageSquare size={18} />
                        </button>
                        {!row.isNew && row.id && (
                          <button 
                            type="button"
                            onClick={() => toggleEditRow(row.id!)}
                            title={editingRowIds.has(row.id!) ? "Concluir edição" : "Editar linha"}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              editingRowIds.has(row.id!) 
                                ? "text-amber-500 bg-amber-500/10 dark:bg-amber-500/20" 
                                : "text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100"
                            )}
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
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
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <div className="p-0">
            <table className="w-full text-left min-w-[1000px] border-none">
              <thead className="sticky top-0 z-20 bg-slate-100/80 dark:bg-slate-900/80 border-none">
                <tr>
                  <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest">Data/Hora</th>
                  <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest">Ação</th>
                  <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest">SKU</th>
                  <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest">Posição</th>
                  <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest">Origem (N/P)</th>
                  <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest">Destino (N/P)</th>
                  <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest">Qtd</th>
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
                          "px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider",
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
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900 dark:text-white">
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
                <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
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
                    className="px-6 py-2.5 text-xs font-normal text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
                  >
                    {obsModalTarget.isNew ? "Cancelar" : "Fechar"}
                  </button>
                  {obsModalTarget.isNew && (
                    <button 
                      onClick={() => {
                        updateRow(obsModalTarget.index, 'Observação', obsModalTarget.value);
                        setObsModalTarget(null);
                      }}
                      className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                      Salvar Observação
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
