import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Box, Check, AlertCircle, Droplet, Package, Info, Calendar, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PalletItemForm {
  id: string;
  sku: string;
  qty: number | '';
  qtyWet: number | '';
  qtyTilted: number | '';
}

interface AddPalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: PalletItemForm[], generatedId: string) => void;
  availableStocks?: { produto: string; available: number }[];
  nextId: string;
  destinationLevel: number | null;
  destinationDepth: number | null;
}

export function AddPalletModal({
  isOpen,
  onClose,
  onSave,
  availableStocks = [],
  nextId,
  destinationLevel,
  destinationDepth
}: AddPalletModalProps) {
  const [items, setItems] = useState<PalletItemForm[]>([
    { id: '1', sku: '', qty: '', qtyWet: '', qtyTilted: '' }
  ]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setItems([{ id: Date.now().toString(), sku: '', qty: '', qtyWet: '', qtyTilted: '' }]);
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

  // Filter valid lines
  const activeProductsCount = items.filter(i => i.sku.trim() !== '').length;
  // MIX is defined as having more than 1 SKU in the same pallet
  const isMix = activeProductsCount > 1;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), sku: '', qty: '', qtyWet: '', qtyTilted: '' }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleChangeSku = (id: string, sku: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, sku, qty: '', qtyWet: '', qtyTilted: '' } : i));
  };

  const handleChangeQtyRaw = (id: string, field: 'qty' | 'qtyWet' | 'qtyTilted', val: string) => {
    const numVal = val === '' ? '' : Math.floor(Number(val));
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    let sanitized: number | '' = typeof numVal === 'number' && isNaN(numVal) ? '' : numVal;
    
    // Validation against floor stock (only for Total Qty)
    if (field === 'qty' && typeof sanitized === 'number') {
        const stockInfo = availableStocks.find(s => s.produto === item.sku);
        const max = stockInfo ? stockInfo.available : 0; 
        if (sanitized > max) sanitized = max;
        if (sanitized < 0) sanitized = 0;
    }

    // Validation for damages (cannot exceed total qty)
    if ((field === 'qtyWet' || field === 'qtyTilted') && typeof sanitized === 'number') {
        const total = typeof item.qty === 'number' ? item.qty : 0;
        if (sanitized > total) sanitized = total;
        if (sanitized < 0) sanitized = 0;
    }

    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: sanitized } : i));
  };

  const handleSave = () => {
    const validItems = items.filter(i => {
        const stockExists = availableStocks.some(s => s.produto === i.sku);
        return i.sku.trim() !== '' && stockExists && typeof i.qty === 'number' && i.qty > 0;
    });
    if (validItems.length === 0) return;
    
    // Pass ID only if it is a MIX pallet
    onSave(validItems, isMix ? nextId : "");
  };

  // Valid if there is at least 1 fully filled item AND its SKU exists in available stock AND qty <= available
  const hasAtLeastOneValid = items.some(i => {
    const stockInfo = availableStocks.find(s => s.produto === i.sku);
    return i.sku.trim() !== '' && stockInfo && typeof i.qty === 'number' && i.qty > 0 && i.qty <= stockInfo.available;
  });
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 16 }}
          className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col relative z-10 border border-slate-200 dark:border-slate-800"
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 flex items-center justify-center">
                <Box size={16} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">Adicionar Palete</h2>
                <span className="text-[10px] font-bold text-slate-400">
                  Nível {destinationLevel} · Prof. {destinationDepth}
                  {isMix && <span className="ml-2 text-blue-500 font-black">· MIX {nextId}</span>}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-400 tabular-nums">{currentTime}</span>
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="w-full">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[40%]">Código</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[10%]">Disp.</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[16%]">Total</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-black text-blue-400 uppercase tracking-widest w-[14%]">
                    <span className="flex items-center justify-center gap-1"><Droplet size={9} />Molhado</span>
                  </th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-black text-rose-400 uppercase tracking-widest w-[14%]">
                    <span className="flex items-center justify-center gap-1"><AlertCircle size={9} />Tombado</span>
                  </th>
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

                      {/* CÓDIGO — searchable */}
                      <td className={cn("px-3 py-2 relative", isActive ? "z-50" : "z-10")} ref={el => { dropdownRefs.current[index] = el as HTMLDivElement | null; }}>
                        <div className="relative">
                          <input
                            type="text"
                            value={item.sku}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              handleChangeSku(item.id, val);
                              setActiveSearchIndex(val ? index : null);
                              if (val) setSelectedIndex(0);
                            }}
                            onFocus={() => { if (item.sku) setActiveSearchIndex(index); }}
                            onKeyDown={(e) => {
                              if (activeSearchIndex === index) {
                                const filtered = availableStocks
                                  .filter(s => s.produto.toUpperCase().includes(item.sku.toUpperCase()))
                                  .slice(0, 10);
                                if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(p => (p + 1) % (filtered.length || 1)); }
                                else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => (p - 1 + (filtered.length || 1)) % (filtered.length || 1)); }
                                else if (e.key === 'Enter' && filtered[selectedIndex]) { e.preventDefault(); handleChangeSku(item.id, filtered[selectedIndex].produto); setActiveSearchIndex(null); }
                                else if (e.key === 'Escape') setActiveSearchIndex(null);
                              }
                            }}
                            placeholder="Buscar código..."
                            className={cn(
                              "w-full h-9 px-3 pr-8 rounded-lg outline-none text-xs font-black font-mono transition-all",
                              "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
                              "text-slate-900 dark:text-blue-50 placeholder:text-slate-400 dark:placeholder:text-slate-400/70",
                              "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10",
                              item.sku && !stockInfo ? "border-red-400 bg-red-50/50 dark:bg-red-900/10 text-red-600 dark:text-red-400" :
                              item.sku && stockInfo ? "border-blue-300 dark:border-blue-500/50" : ""
                            )}
                          />
                          {/* Dropdown */}
                          <AnimatePresence>
                            {isActive && item.sku && (
                              <motion.div
                                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
                                className="absolute left-0 top-full mt-1 z-[999] w-[150%] max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden shadow-black/50"
                              >
                                <div className="max-h-56 overflow-y-auto custom-scrollbar">
                                  {availableStocks
                                    .filter(s => s.produto.toUpperCase().includes(item.sku.toUpperCase()))
                                    .slice(0, 10)
                                    .map((stock, idx) => (
                                      <button
                                        key={stock.produto} type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => { handleChangeSku(item.id, stock.produto); setActiveSearchIndex(null); }}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        className={cn(
                                          "w-full px-3 py-2 flex items-center justify-between text-left border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors",
                                          selectedIndex === idx ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                        )}
                                      >
                                        <span className="text-xs font-black font-mono text-slate-900 dark:text-white">{stock.produto}</span>
                                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", stock.available > 0 ? "bg-slate-100 dark:bg-slate-800 text-slate-500" : "bg-red-100 text-red-600")}>
                                          {stock.available} un
                                        </span>
                                      </button>
                                    ))}
                                  {availableStocks.filter(s => s.produto.toUpperCase().includes(item.sku.toUpperCase())).length === 0 && (
                                    <div className="py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum encontrado</div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>

                      {/* DISP. */}
                      <td className="px-2 py-2 text-center">
                        <span className={cn(
                          "text-xs font-black tabular-nums",
                          !stockInfo ? "text-slate-300 dark:text-slate-700" :
                          stockInfo.available > 0 ? "text-slate-600 dark:text-slate-300" : "text-red-500"
                        )}>
                          {stockInfo ? stockInfo.available : '—'}
                        </span>
                      </td>

                      {/* TOTAL */}
                      <td className="px-2 py-2">
                        <input type="number" disabled={!item.sku} value={item.qty}
                          onChange={(e) => handleChangeQtyRaw(item.id, 'qty', e.target.value)}
                          min={0} placeholder="0"
                          className={cn(
                            "w-full h-9 px-1 rounded-lg border outline-none text-sm font-black text-center transition-all bg-slate-50 dark:bg-slate-800",
                            !item.sku ? "opacity-30 cursor-not-allowed border-slate-200" :
                            isMaxedOut ? "border-amber-400 text-amber-600" : "border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          )}
                        />
                      </td>

                      {/* MOLHADO */}
                      <td className="px-2 py-2">
                        <input type="number" disabled={!item.sku || !item.qty} value={item.qtyWet}
                          onChange={(e) => handleChangeQtyRaw(item.id, 'qtyWet', e.target.value)}
                          min={0} placeholder="0"
                          className={cn(
                            "w-full h-9 px-1 rounded-lg border outline-none text-sm font-black text-center transition-all bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600",
                            (!item.sku || !item.qty) ? "opacity-30 cursor-not-allowed" : "text-blue-600"
                          )}
                        />
                      </td>

                      {/* TOMBADO */}
                      <td className="px-2 py-2">
                        <input type="number" disabled={!item.sku || !item.qty} value={item.qtyTilted}
                          onChange={(e) => handleChangeQtyRaw(item.id, 'qtyTilted', e.target.value)}
                          min={0} placeholder="0"
                          className={cn(
                            "w-full h-9 px-1 rounded-lg border outline-none text-sm font-black text-center transition-all bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600",
                            (!item.sku || !item.qty) ? "opacity-30 cursor-not-allowed" : "text-rose-600"
                          )}
                        />
                      </td>

                      {/* REMOVE */}
                      <td className="px-2 py-2 text-center">
                        {items.length > 1 && (
                          <button onClick={() => handleRemoveItem(item.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all mx-auto"
                          >
                            <X size={13} strokeWidth={3} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Add Row Button ── */}
          <button onClick={handleAddItem}
            className="mx-5 my-3 h-9 flex items-center justify-center gap-2 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:border-blue-300 hover:text-blue-500 transition-all"
          >
            <Plus size={14} strokeWidth={3} /> + Produto (MIX)
          </button>

          {/* ── Footer ── */}
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button onClick={onClose}
              className="px-5 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!hasAtLeastOneValid}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-black text-white flex items-center gap-2 transition-all",
                hasAtLeastOneValid ? "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20" : "bg-slate-300 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
              )}
            >
              Confirmar <Check size={15} strokeWidth={3} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
