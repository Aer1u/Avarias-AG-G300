import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Box, Check, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PalletItemForm {
  id: string;
  sku: string;
  qty: number | '';
  descricao?: string;
}

interface AddPalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: PalletItemForm[], generatedId: string) => void;
  availableStocks?: { produto: string; available: number }[];
  nextId: string;
  destinationLevel: number | null;
  destinationDepth: number | null;
  selectedSlotsCount?: number;
  ignoreStockValidation?: boolean;
}

export function AddPalletModal({
  isOpen,
  onClose,
  onSave,
  availableStocks = [],
  nextId,
  destinationLevel,
  destinationDepth,
  selectedSlotsCount = 1,
  ignoreStockValidation = false
}: AddPalletModalProps) {
  const [items, setItems] = useState<PalletItemForm[]>([
    { id: '1', sku: '', qty: '', descricao: '' }
  ]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  const slotsCount = selectedSlotsCount > 0 ? selectedSlotsCount : 1;

  useEffect(() => {
    if (isOpen) {
      setItems([{ id: Date.now().toString(), sku: '', qty: '', descricao: '' }]);
      setActiveSearchIndex(null);
      const now = new Date();
      setCurrentTime(now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideAny = dropdownRefs.current.some(ref => ref && ref.contains(target));
      if (!isInsideAny) setActiveSearchIndex(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const activeProductsCount = items.filter(i => i.sku.trim() !== '').length;
  const isMix = activeProductsCount > 1;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), sku: '', qty: '', descricao: '' }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleChangeSku = (id: string, sku: string, descricao?: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, sku, descricao: descricao || i.descricao, qty: '' } : i));
  };

  const handleChangeQtyRaw = (id: string, field: 'qty', val: string) => {
    const numVal = val === '' ? '' : Math.floor(Number(val));
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    let sanitized: number | '' = typeof numVal === 'number' && isNaN(numVal) ? '' : numVal;
    
    if (typeof sanitized === 'number' && sanitized < 0) sanitized = 0;

    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: sanitized } : i));
  };

  const normSku = (s: string) => String(s || '').trim().toUpperCase().replace(/[\s\-_]/g, '');

  const handleSave = () => {
    const validItems = items.filter(i => i.sku.trim() !== '' && typeof i.qty === 'number' && i.qty > 0);
    if (validItems.length === 0) return;
    
    onSave(validItems, isMix ? nextId : "");
  };

  const hasAtLeastOneValid = items.some(i => i.sku.trim() !== '' && typeof i.qty === 'number' && i.qty > 0);
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 16 }}
          className="bg-white dark:bg-[#0d131f] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col relative z-10 border border-slate-200 dark:border-slate-800/80 max-h-[92vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-3 py-3 sm:px-5 sm:py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/20 rounded-t-2xl">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 flex items-center justify-center shrink-0">
                <Box size={14} className="sm:w-4 sm:h-4" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-light text-slate-900 dark:text-white tracking-tight">Adicionar Palete</h2>
                <span className="text-[9px] sm:text-[10px] font-light text-slate-400">Nível {destinationLevel} · Prof. {destinationDepth}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <X size={16} />
            </button>
          </div>

          <div className="w-full overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[400px] sm:min-w-0 text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700/50">
                  <th className="text-left px-4 py-2.5 text-[10px] font-light text-slate-400 uppercase tracking-widest w-[50%]">Código</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-light text-slate-400 uppercase tracking-widest w-[20%]">Disp.</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-light text-slate-400 uppercase tracking-widest w-[20%]">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const stockInfo = availableStocks.find(s => s.produto === item.sku);
                  const isMaxedOut = typeof item.qty === 'number' && stockInfo && item.qty >= stockInfo.available;
                  const isActive = activeSearchIndex === index;

                  return (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className={cn("px-3 py-2 relative", isActive ? "z-50" : "z-10")} ref={el => { dropdownRefs.current[index] = el as HTMLDivElement | null; }}>
                        <input
                          type="text" value={item.sku}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            handleChangeSku(item.id, val);
                            setActiveSearchIndex(val ? index : null);
                          }}
                          className="w-full h-9 px-3 rounded-lg border bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-xs font-light font-mono"
                          placeholder="Buscar código..."
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                         <span className="text-xs text-slate-600 dark:text-slate-300 font-light">{stockInfo?.available || '—'}</span>
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" disabled={!item.sku} value={item.qty}
                          onChange={(e) => handleChangeQtyRaw(item.id, 'qty', e.target.value)}
                          min={0} placeholder="0"
                          className="w-full h-9 px-1 rounded-lg border bg-white dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 text-sm font-light text-center"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {items.length > 1 && (
                          <button onClick={() => handleRemoveItem(item.id)} className="text-rose-500 hover:text-rose-600"><X size={14} /></button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button onClick={handleAddItem} className="mx-5 my-3 h-9 flex items-center justify-center gap-2 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 font-light text-xs uppercase rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all">
            <Plus size={14} strokeWidth={3} /> + Produto (MIX)
          </button>

          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-light text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">Cancelar</button>
            <button onClick={handleSave} disabled={!hasAtLeastOneValid} className="px-6 py-2 rounded-xl text-sm font-light text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Confirmar</button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
