"use client"

import React, { useCallback } from "react"
import { Package, AlertCircle, Droplet, Lock, ArrowLeft, RefreshCw, Edit2, Trash2, Check, CheckSquare, Square, PlusSquare, XSquare, X } from "lucide-react"
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { AddPalletModal, PalletItemForm } from "./AddPalletModal"

interface Product {
  sku: string
  descricao: string
  nivel: string | number
  quantidade: number
  paletes: number
  profundidade: string | number
  qtd_por_palete: number
  id_palete?: string
  id?: number | string
  fracao_paletes?: number
  qtd_tombada?: number
  qtd_molhado?: number
}

type LocalProduct = Product & { _original_nivel: string | number; _original_profundidade: string | number }

let nextGridTempId = 1;

interface DriveInGridProps {
  products: Product[]
  capacity: number
  levelCount: number
  isBlocked?: boolean
  observation?: string
  positionId?: string
  onEditSuccess?: () => void
  availableStocks?: { produto: string; available: number }[]
  mapeamentoData?: any[]
  pendingChanges: any[]
  setPendingChanges: React.Dispatch<React.SetStateAction<any[]>>
  ignoreStockValidation?: boolean
}

export function DriveInGrid({ 
  products, 
  capacity, 
  levelCount, 
  isBlocked, 
  observation, 
  positionId, 
  onEditSuccess,
  availableStocks = [],
  mapeamentoData = [],
  pendingChanges,
  setPendingChanges,
  ignoreStockValidation = false
}: DriveInGridProps) {
  const [selectedCoords, setSelectedCoords] = React.useState<{ lvl: number; d: number } | null>(null)
  const [draggingCoords, setDraggingCoords] = React.useState<{ lvl: number; d: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const justDragged = React.useRef(false)
  
  const [isEditModeActive, setIsEditModeActive] = React.useState(false)
  const [selectedGaps, setSelectedGaps] = React.useState<Set<string>>(new Set())
  const [addingCoords, setAddingCoords] = React.useState<{ lvl: number; d: number } | null>(null)
  const [editingProduct, setEditingProduct] = React.useState<LocalProduct | null>(null)
  const [isSelectingProductToEdit, setIsSelectingProductToEdit] = React.useState(false)
  const [removeTargetModal, setRemoveTargetModal] = React.useState<{
    title: string;
    items: Product[];
    onConfirm: (targetPos: 'Chão' | 'Retrabalho' | 'Eliminar') => void;
  } | null>(null)

  const executeMoveProductsToDestination = (items: Product[], targetPos: 'Chão' | 'Retrabalho' | 'Eliminar') => {
    setIsSubmitting(true);
    console.log("Executing move. Items:", items, "Target:", targetPos);
    try {
      const acao = targetPos === 'Retrabalho' ? 'ENVIAR_RETRABALHO' : (targetPos === 'Eliminar' ? 'ELIMINAR' : 'MOVER_CHAO');
      const newDeleteChanges = items.map(p => ({
        id: p.id,
        type: 'DELETE',
        targetPosition: targetPos,
        payload: {
          id: p.id,
          'Código': p.sku,
          'Quantidade': p.quantidade,
          sku: p.sku,
          quantidade_total: p.quantidade,
          targetPosition: targetPos
        },
        audit: {
          acao: acao,
          sku: p.sku,
          posicao: positionId,
          nivel: p.nivel,
          profundidade: p.profundidade,
          quantidade: p.quantidade
        }
      }));
      console.log("Adding delete changes:", newDeleteChanges);
      setPendingChanges(prev => [...prev, ...newDeleteChanges]);
      
      // Update selection if the selected cell is being cleared
      if (selectedCoords) {
        const isSelectedCellInvolved = items.some(p => Number(p.nivel) === selectedCoords.lvl && Number(p.profundidade) === selectedCoords.d);
        if (isSelectedCellInvolved) {
          setSelectedCoords(null);
        }
      }
    } catch (err) {
      console.error("Move Destination Error:", err);
    } finally {
      setIsSubmitting(false);
      setRemoveTargetModal(null);
    }
  };

  const toggleGapSelection = (lvl: number, d: number) => {
    const key = `${lvl}-${d}`
    setSelectedGaps(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAllGaps = () => {
    setSelectedGaps(prev => {
      if (prev.size === levels.length * depths.length) return new Set()
      const next = new Set<string>()
      levels.forEach(lvl => {
        depths.forEach(d => next.add(`${lvl}-${d}`))
      })
      return next
    })
  }

  // Local display hint only (may not reflect global state perfectly if not refreshed, but page.tsx syncs it)
  const maxPId = React.useMemo(() => {
    return mapeamentoData
      .map((row: any) => {
        const rawVal = row.id_palete || row['Id Palete']; // Fallback in case format varies
        if (!rawVal || typeof rawVal !== 'string') return 0;
        const val = rawVal.trim().toUpperCase();
        if (!val.startsWith('P.')) return 0;
        const num = parseInt(val.replace('P.', ''), 10);
        return isNaN(num) ? 0 : num;
      })
      .reduce((max, current) => Math.max(max, current), 0)
  }, [mapeamentoData])

  const nextPalletId = `P.${(maxPId + 1).toString().padStart(3, '0')}`

  // Fetch the true next pallet ID from Supabase to avoid conflicts
  const getNextPalletIdFromDB = async (): Promise<string> => {
    const { data, error } = await supabase
      .from('mapeamento')
      .select('Id Palete')
      .not('Id Palete', 'is', null)
      .order('Id Palete', { ascending: false })
      .limit(10); // Check last 10 just in case of formatting variations
    
    if (error || !data || data.length === 0) {
       return 'P.001';
    }
    
    const maxNum = data
      .map((row: any) => {
        const rawVal = row['Id Palete'];
        if (!rawVal || typeof rawVal !== 'string') return 0;
        const val = rawVal.trim().toUpperCase();
        if (!val.startsWith('P.')) return 0;
        const num = parseInt(val.replace('P.', ''), 10);
        return isNaN(num) ? 0 : num;
      })
      .reduce((max, n) => Math.max(max, n), 0);
    
    return `P.${(maxNum + 1).toString().padStart(3, '0')}`;
  }

  const handleModalSave = async (items: PalletItemForm[], generatedId: string) => {
    if (!addingCoords) return;
    
    setIsSubmitting(true)
    try {
      const targetKeys = selectedGaps.size > 0 && selectedGaps.has(`${addingCoords.lvl}-${addingCoords.d}`)
        ? Array.from(selectedGaps)
        : [`${addingCoords.lvl}-${addingCoords.d}`];

      const targetCount = targetKeys.length;

      const batchMixId = targetKeys.length > 1 ? await getNextPalletIdFromDB() : null;
      let mixIdCounter = 0;

      const newPendingChanges: any[] = [];
      let index = 0;

      for (const key of targetKeys) {
        const [targetLvl, targetD] = key.split('-').map(Number);
        
        let finalId: string | null = generatedId; // Use the one from the modal

        items.forEach(item => {
          const tempId = `temp_${nextGridTempId++}`;
          const changePayload = {
            id: tempId,
            'Posição': positionId,
            'Código': item.sku,
            'Quantidade': typeof item.qty === 'number' ? item.qty : 0,
            'Nível': targetLvl,
            'Profundidade': targetD,
            'Id Palete': finalId,
            // Sync with page.tsx reactive keys
            posicao: positionId,
            produto: item.sku,
            descricao: item.descricao || "Produto Adicionado",
            quantidade_total: typeof item.qty === 'number' ? item.qty : 0,
            nivel: targetLvl,
            profundidade: targetD,
            paletes: 1, // Default for new entry in Drive-In
            // Aliases
            cod: item.sku,
            qtd: typeof item.qty === 'number' ? item.qty : 0,
            nv: targetLvl,
            pr: targetD
          };

          newPendingChanges.push({
            id: tempId,
            type: 'ADD',
            payload: changePayload,
            audit: {
              acao: 'ADICIONAR',
              sku: item.sku,
              posicao: positionId,
              nivel: targetLvl,
              profundidade: targetD,
              quantidade: item.qty,
              id_palete: finalId
            }
          });
        });
      }

      setPendingChanges(prev => [...prev, ...newPendingChanges]);
    } catch (err) {
      console.error("Error adding to pending changes:", err);
    } finally {
      setIsSubmitting(false)
      setAddingCoords(null)
      setSelectedGaps(new Set())
    }
  }

  const handleBatchMoveToFloor = async () => {
    if (selectedGaps.size === 0) return;
    
    const itemsToMove: Product[] = [];
    selectedGaps.forEach(key => {
      const [lvl, d] = key.split('-').map(Number);
      if (grid[lvl] && grid[lvl][d]) {
        itemsToMove.push(...grid[lvl][d]);
      }
    });

    if (itemsToMove.length === 0) {
      setSelectedGaps(new Set());
      return;
    }

    setRemoveTargetModal({
      title: `Remover ${itemsToMove.length} item(ns) de ${selectedGaps.size} grade(s)`,
      items: itemsToMove,
      onConfirm: (targetPos) => {
        executeMoveProductsToDestination(itemsToMove, targetPos);
        setSelectedGaps(new Set());
      }
    });
  }

  // 1. Generate range of levels based on total height
  const levels = React.useMemo(() => Array.from({ length: levelCount }, (_, i) => i).sort((a, b) => b - a), [levelCount]);

  const getEffectiveProducts = useCallback(() => {
    const effectiveProducts: LocalProduct[] = products.map(p => ({
        ...p,
        _original_nivel: p.nivel,
        _original_profundidade: p.profundidade
    })).map(p => {
        const change = pendingChanges.find(c => String(c.id) === String(p.id));
        if (change?.type === 'UPDATE') {
            return { ...p, ...change.payload, nivel: change.payload.nivel, profundidade: change.payload.profundidade };
        }
        return p;
    }).filter(p => !pendingChanges.find(c => String(c.id) === String(p.id) && c.type === 'DELETE'));

    // Add new items
    pendingChanges.filter(c => c.type === 'ADD').forEach(c => {
        effectiveProducts.push({
            ...c.payload,
            _original_nivel: c.payload.nivel,
            _original_profundidade: c.payload.profundidade
        });
    });
    return effectiveProducts;
  }, [products, pendingChanges]);

  const { depths, maxDepth, grid } = React.useMemo(() => {
    const effectiveProducts = getEffectiveProducts();
    
    // Calculate max depth
    const dataDepths = Array.from(new Set(effectiveProducts.map(p => {
      const d = parseInt(String(p.profundidade).replace(/\D/g, ""))
      return isNaN(d) ? 0 : d
    }))).filter(d => d > 0)
    
    const calculatedMaxDepth = levelCount > 0 ? Math.ceil(capacity / levelCount) : 0
    const mDepth = Math.max(calculatedMaxDepth, ...dataDepths, 1)
    const dps = Array.from({ length: mDepth }, (_, i) => i + 1)

    // Distribution Logic
    const g: Record<number, Record<number, LocalProduct[]>> = {}
    levels.forEach(lvl => {
      g[lvl] = {}
      dps.forEach(d => { g[lvl][d] = [] })
    })

    // Group products by level
    levels.forEach(lvl => {
      const levelProducts = effectiveProducts.filter(p => Number(p.nivel) === Number(lvl))
      
      const remainingProducts: LocalProduct[] = []
      levelProducts.forEach(p => {
        const d = parseInt(String(p.profundidade).replace(/\D/g, ""))
        if (!isNaN(d) && d > 0 && d <= mDepth) {
          g[lvl][d].push(p)
        } else if (p.sku !== "Posição Vazia") {
          remainingProducts.push(p)
        }
      })

      const groupedById = new Map<string, LocalProduct[]>()
      const wholePallets: LocalProduct[] = []

      remainingProducts.forEach(p => {
        if (p.id_palete) {
          if (!groupedById.has(p.id_palete)) groupedById.set(p.id_palete, [])
          groupedById.get(p.id_palete)!.push(p)
        } else {
          wholePallets.push(p)
        }
      })

      const finalGroups: LocalProduct[][] = Array.from(groupedById.values())
      wholePallets.forEach(p => finalGroups.push([p]))

      let currentDepth = 1
      finalGroups.forEach(group => {
        let cellsNeeded = 1
        
        while (cellsNeeded > 0 && currentDepth <= mDepth) {
          if (g[lvl][currentDepth].length === 0) {
            g[lvl][currentDepth].push(...group)
            cellsNeeded--
          }
          currentDepth++
        }
      })
    })

    return { depths: dps, maxDepth: mDepth, grid: g }
  }, [getEffectiveProducts, levels, capacity, levelCount]);

  const handleEditClick = (p: Product) => {
    setEditingProduct({ ...p, _original_nivel: p.nivel, _original_profundidade: p.profundidade })
    setIsEditModeActive(true)
  }

  React.useEffect(() => {
    const handleTriggerEdit = () => {
      setIsEditModeActive(prev => {
        if (prev) {
          setEditingProduct(null)
          setAddingCoords(null)
          setSelectedGaps(new Set())
          return false
        }
        return true
      })
    }

    window.addEventListener("trigger-drivein-edit", handleTriggerEdit)
    return () => window.removeEventListener("trigger-drivein-edit", handleTriggerEdit)
  }, [])

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    
    setIsSubmitting(true)
    try {
      const rowIdToUpdate = editingProduct.id;
      if (!rowIdToUpdate) return;

      const newQty = Number(editingProduct.quantidade) || 0;
      const originalProduct = products.find(p => String(p.id) === String(editingProduct.id));
      const originalQty = originalProduct ? (Number(originalProduct.quantidade) || 0) : newQty;
      const diff = newQty - originalQty;

      const normSku = (s: string) => String(s || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
      const floorStock = availableStocks.find(s => normSku(s.produto) === normSku(editingProduct.sku))?.available || 0;

      if (diff > floorStock) {
        alert(`⚠️ Impeditivo: Saldo insuficiente no Chão para aumentar a quantidade em ${diff} un. Saldo disponível no Chão para o SKU ${editingProduct.sku}: ${floorStock} un.`);
        setIsSubmitting(false);
        return;
      }

      setPendingChanges(prev => [...prev, {
        id: rowIdToUpdate,
        type: 'UPDATE',
        payload: {
          id: rowIdToUpdate,
          'Quantidade': newQty,
          'Nível': parseFloat(String(editingProduct.nivel)),
          'Profundidade': editingProduct.profundidade,
          'Parte Tombada': parseFloat(String(editingProduct.qtd_tombada || 0)),
          'Parte Molhada': parseFloat(String(editingProduct.qtd_molhado || 0)),
          'Id Palete': editingProduct.id_palete,
          sku: editingProduct.sku,
          quantidade_total: newQty,
          nivel: parseFloat(String(editingProduct.nivel)),
          profundidade: editingProduct.profundidade,
          qtd_tombada: parseFloat(String(editingProduct.qtd_tombada || 0)),
          qtd_molhado: parseFloat(String(editingProduct.qtd_molhado || 0)),
          nv: editingProduct.nivel,
          pr: editingProduct.profundidade
        },
        audit: {
          acao: 'EDITAR',
          sku: editingProduct.sku,
          posicao: positionId,
          nivel: editingProduct.nivel,
          profundidade: editingProduct.profundidade,
          quantidade: newQty,
          quantidade_anterior: originalQty
        }
      }]);

      // Update selection if the edited product was in the selected cell and its position changed
      if (selectedCoords && selectedCoords.lvl === Number(editingProduct._original_nivel) && selectedCoords.d === Number(editingProduct._original_profundidade)) {
        setSelectedCoords({ lvl: Number(editingProduct.nivel), d: Number(editingProduct.profundidade) });
      }

      setEditingProduct(null);
    } catch (err) {
      console.error("Error saving edit:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleMoveItemToFloor = async (product: Product) => {
    setRemoveTargetModal({
      title: `Remover item ${product.sku} (qtd: ${product.quantidade})`,
      items: [product],
      onConfirm: (targetPos) => executeMoveProductsToDestination([product], targetPos)
    });
  };

  const handleMoveCellToFloor = async (prods: Product[]) => {
    if (prods.length === 0) return;

    setRemoveTargetModal({
      title: `Esvaziar Célula: Remover ${prods.length} item(ns)`,
      items: prods,
      onConfirm: (targetPos) => executeMoveProductsToDestination(prods, targetPos)
    });
  };

  const isInternalSwap = React.useRef(false);

  const handleSwap = (source: { lvl: number; d: number }, target: { lvl: number; d: number }) => {
    if (source.lvl === target.lvl && source.d === target.d) return
    
    const effectiveProducts = getEffectiveProducts();
    const sourceProducts = effectiveProducts.filter(p => Number(p.nivel) === source.lvl && Number(p.profundidade) === source.d);
    const targetProducts = effectiveProducts.filter(p => Number(p.nivel) === target.lvl && Number(p.profundidade) === target.d);

    if (sourceProducts.length === 0 && targetProducts.length === 0) return;

    const newChanges: any[] = [];
    
    sourceProducts.forEach(p => {
      newChanges.push({
        id: p.id,
        type: 'UPDATE',
        payload: { 
          id: p.id, 
          'Nível': target.lvl, 
          'Profundidade': target.d, 
          nivel: target.lvl, 
          profundidade: target.d,
          nv: target.lvl, 
          pr: target.d 
        },
        audit: { acao: 'MOVER', sku: p.sku, posicao: positionId, nivel: target.lvl, profundidade: target.d, nivel_anterior: p.nivel, prof_anterior: p.profundidade, quantidade: p.quantidade }
      });
    });

    targetProducts.forEach(p => {
      newChanges.push({
        id: p.id,
        type: 'UPDATE',
        payload: { 
          id: p.id, 
          'Nível': source.lvl, 
          'Profundidade': source.d, 
          nivel: source.lvl, 
          profundidade: source.d,
          nv: source.lvl, 
          pr: source.d 
        },
        audit: { acao: 'MOVER', sku: p.sku, posicao: positionId, nivel: source.lvl, profundidade: source.d, nivel_anterior: p.nivel, prof_anterior: p.profundidade, quantidade: p.quantidade }
      });
    });

    isInternalSwap.current = true

    setPendingChanges(prev => {
      let next = [...prev];

      for (const change of newChanges) {
        const itemId = String(change.id);
        const existingIdx = next.findIndex(c => String(c.id) === itemId && c.type === 'UPDATE');

        const localItem = effectiveProducts.find(p => String(p.id) === itemId);
        const origNivel = localItem?._original_nivel;
        const origProf = localItem?._original_profundidade;

        const newNivel = change.payload.nivel;
        const newProf = change.payload.profundidade;

        const isReturnToOrigin = (
          origNivel !== undefined &&
          origProf !== undefined &&
          String(newNivel) === String(origNivel) &&
          String(newProf) === String(origProf)
        );

        if (existingIdx !== -1) {
          if (isReturnToOrigin) {
            next.splice(existingIdx, 1);
          } else {
            next[existingIdx] = change;
          }
        } else {
          if (!isReturnToOrigin) {
            next.push(change);
          }
        }
      }

      return next;
    });
    
    // Update selection if swap involves the selected cell
    if (selectedCoords) {
      console.log("Swap: updating selection from", selectedCoords, "to", source, target);
      if (selectedCoords.lvl === source.lvl && selectedCoords.d === source.d) {
        setSelectedCoords(target);
      } else if (selectedCoords.lvl === target.lvl && selectedCoords.d === target.d) {
        setSelectedCoords(source);
      }
    }
  }

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-900/50 rounded-[2.5rem] border border-dashed border-slate-700">
        <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <Lock size={32} />
        </div>
        <h3 className="text-lg font-light text-slate-200 uppercase tracking-widest">Drive Bloqueado</h3>
        <p className="text-xs font-normal text-slate-400 uppercase mt-2">{observation || "Sem observações"}</p>
      </div>
    )
  }

  const selectedCellProducts = selectedCoords ? grid[selectedCoords.lvl][selectedCoords.d] : []
  const selectedProduct = selectedCellProducts[0] || null

  const { totalQty, totalPallets, uniqueSkus, isMixed } = React.useMemo(() => {
    const prods = getEffectiveProducts();
    const tQty = prods.reduce((sum, p) => sum + p.quantidade, 0)
    const tPallets = prods.reduce((sum, p) => sum + p.paletes, 0)
    const uSkus = new Set(prods.map(p => p.sku)).size
    return {
      totalQty: tQty,
      totalPallets: tPallets,
      uniqueSkus: uSkus,
      isMixed: uSkus > 1
    }
  }, [getEffectiveProducts])

  return (
    <div className="w-full flex flex-col gap-4 relative">
      <style>{`
        .grid-is-dragging .add-pallete-btn {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        .drop-target-active {
          transform: scale(1.08) !important;
          border-color: #3b82f6 !important;
          border-width: 3px !important;
          background-color: rgba(59, 130, 246, 0.15) !important;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3) !important;
          z-index: 40 !important;
        }
      `}</style>

      <AnimatePresence>
        {isSubmitting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-[2.5rem]"
          >
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
              <RefreshCw className="animate-spin text-blue-500" size={32} />
              <p className="text-xs font-semibold uppercase tracking-widest text-white">Efetuando Troca...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Package className="text-blue-400" size={24} />
          <div>
            <h2 className="text-sm font-normal text-white uppercase tracking-wider">Drive-In Grid Manager: {positionId || "RUA-01"}</h2>
            <p className="text-[10px] text-slate-400 uppercase">Arraste paletes entre vãos ou ative o modo de edição para gerenciar</p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsEditModeActive(prev => {
              const next = !prev;
              if (!next) {
                setEditingProduct(null);
                setAddingCoords(null);
                setSelectedGaps(new Set());
              }
              return next;
            });
          }}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-normal uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg",
            isEditModeActive 
              ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20" 
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
          )}
        >
          {isEditModeActive ? "✓ Concluir Edição" : "✎ Habilitar Edição & Movimentação"}
        </button>
      </div>

      <div className="w-full flex flex-col lg:flex-row gap-6 relative">
        <div className="flex-1 overflow-x-auto custom-scrollbar pt-2 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/80">
          <div className="flex flex-col items-center min-w-full">
            <div className="relative inline-block">
              <div className="flex mb-4">
                 <div className="w-8 md:w-14 shrink-0 pr-1 md:pr-4 text-right">
                    <span className="text-[9px] font-light text-slate-500 uppercase tracking-widest">NÍVEL</span>
                 </div>
              </div>

              <div className="flex items-start">
                <div className="space-y-1.5 md:space-y-4 mb-4 md:mb-8 pr-2 md:pr-4">
                  {levels.map(lvl => {
                    const val = parseFloat(String(lvl))
                    const displayLvl = isNaN(val) ? lvl : Math.floor(val).toString()
                    
                    return (
                      <div key={`row-${lvl}`} className="flex items-center">
                         <div className="w-8 md:w-14 shrink-0 pr-1 md:pr-4 text-right">
                          <span className="text-[13px] font-light text-white uppercase tracking-tighter">
                            {displayLvl}
                          </span>
                        </div>

                        <div className="flex gap-1.5 md:gap-4">
                          {depths.map(d => {
                            const cellProducts = grid[lvl][d]
                            const isEmpty = cellProducts.length === 0
                            const isSelected = selectedCoords?.lvl === lvl && selectedCoords?.d === d
                            const isMixedCell = new Set(cellProducts.map(p => p.sku)).size > 1
                            const sku = !isEmpty ? (isMixedCell ? `${cellProducts.length} Prods` : cellProducts[0].sku) : ""
                            const qty = !isEmpty ? Math.round(cellProducts.reduce((sum, p) => sum + p.quantidade, 0)) : 0
                            const isGridSelected = selectedGaps.has(`${lvl}-${d}`)
                            
                            return (
                              <div 
                                key={`cell-${lvl}-${d}`} 
                                data-grid-slot="true"
                                data-lvl={lvl}
                                data-d={d}
                                onClick={() => {
                                  if (justDragged.current) return
                                  if (isEditModeActive) {
                                    toggleGapSelection(lvl, d)
                                  } else if (!isEmpty) {
                                    setSelectedCoords(isSelected ? null : { lvl, d })
                                  }
                                }}
                                className={cn(
                                  "w-20 h-20 sm:w-28 sm:h-28 md:w-28 md:h-28 rounded-xl border relative group flex items-center justify-center p-1 sm:p-2 text-center transition-all duration-200 cursor-pointer shrink-0",
                                  isEmpty 
                                    ? "bg-slate-950/40 border-slate-800"
                                    : "bg-slate-900 border-slate-700",
                                  !draggingCoords && "hover:scale-[1.04]",
                                  isSelected && "border-[3px] border-blue-500 z-20 scale-[1.02]",
                                  isGridSelected && "border-orange-500 ring-4 ring-orange-500/10 bg-orange-950/10 z-20",
                                  (draggingCoords?.lvl === lvl && draggingCoords?.d === d) && "z-[60]"
                                )}
                              >
                                {isEditModeActive && (
                                  <div className="absolute top-2 right-2 z-30">
                                    {isGridSelected ? (
                                      <div className="bg-orange-500 text-white rounded-md p-0.5 shadow-sm">
                                        <Check size={12} strokeWidth={4} />
                                      </div>
                                    ) : (
                                      <div className="bg-slate-800 text-slate-500 rounded-md p-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <Square size={12} />
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!isEmpty ? (
                                  <motion.div 
                                    key={cellProducts.map(p => p.id).join('-')}
                                    drag={isEditModeActive}
                                    dragMomentum={false}
                                    dragElastic={0}
                                    onClick={(e) => {
                                      if (isEditModeActive) e.stopPropagation()
                                    }}
                                    onDragStart={() => {
                                      justDragged.current = false
                                      document.body.classList.add('grid-is-dragging')
                                      setDraggingCoords({ lvl, d })
                                    }}
                                    onDrag={(e, info) => {
                                      if (!document.body.classList.contains('grid-is-dragging')) return;
                                      const clientX = 'clientX' in e ? (e as any).clientX : (e as any).touches?.[0]?.clientX || (e as any).changedTouches?.[0]?.clientX;
                                      const clientY = 'clientY' in e ? (e as any).clientY : (e as any).touches?.[0]?.clientY || (e as any).changedTouches?.[0]?.clientY;
                                      if (clientX && clientY) {
                                        const elements = document.elementsFromPoint(clientX, clientY);
                                        const cell = elements.find(el => el?.getAttribute?.('data-grid-slot') === "true");
                                        
                                        document.querySelectorAll('.drop-target-active').forEach(node => {
                                          node.classList.remove('drop-target-active');
                                        });

                                        if (cell) {
                                          const targetLvl = Number(cell.getAttribute('data-lvl'));
                                          const targetD = Number(cell.getAttribute('data-d'));
                                          if (targetLvl !== lvl || targetD !== d) {
                                            cell.classList.add('drop-target-active');
                                          }
                                        }
                                      }
                                    }}
                                    onDragEnd={(e, info) => {
                                      justDragged.current = true
                                      setTimeout(() => { justDragged.current = false }, 300)

                                      document.body.classList.remove('grid-is-dragging')
                                      setDraggingCoords(null)
                                      
                                      document.querySelectorAll('.drop-target-active').forEach(node => {
                                        node.classList.remove('drop-target-active');
                                      });
                                      const clientX = 'clientX' in e ? (e as any).clientX : (e as any).touches?.[0]?.clientX || (e as any).changedTouches?.[0]?.clientX;
                                      const clientY = 'clientY' in e ? (e as any).clientY : (e as any).touches?.[0]?.clientY || (e as any).changedTouches?.[0]?.clientY;
                                      
                                      if (clientX && clientY) {
                                        const elements = document.elementsFromPoint(clientX, clientY);
                                        const cell = elements.find(el => el?.getAttribute?.('data-grid-slot') === "true");
                                        
                                        if (cell) {
                                          const targetLvl = Number(cell.getAttribute('data-lvl'));
                                          const targetD = Number(cell.getAttribute('data-d'));
                                          if (!isNaN(targetLvl) && !isNaN(targetD) && (targetLvl !== lvl || targetD !== d)) {
                                            handleSwap({ lvl, d }, { lvl: targetLvl, d: targetD });
                                          }
                                        }
                                      }
                                    }}
                                    whileDrag={{ 
                                      scale: 1.1, 
                                      zIndex: 100, 
                                      rotate: 2,
                                      boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                                      opacity: 0.9
                                    }}
                                    className={cn(
                                      "w-[94%] h-[94%] rounded-xl flex flex-col items-center justify-between overflow-hidden relative transition-colors touch-none shadow-md",
                                      isEditModeActive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                                      "bg-slate-800",
                                      isMixedCell
                                        ? "shadow-[inset_0_0_20px_rgba(217,119,6,0.25)] border-[1.5px] border-amber-500/40"
                                        : "shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] border-[1.5px] border-slate-700 hover:brightness-110"
                                    )}
                                  >
                                    <div className="absolute top-1 right-1 flex gap-1 z-20">
                                        {isMixedCell && (
                                            <div className="px-1.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                                                <span className="text-[8px] font-light text-white uppercase">Mix</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 flex flex-col items-center justify-center w-full mt-2">
                                      <div className="relative group-hover:-translate-y-0.5 transition-transform duration-300 flex flex-col items-center">
                                        <span className="text-2xl md:text-[32px] drop-shadow-md inline-block relative z-10 leading-none">📦</span>
                                        <div className="w-9 h-[4px] bg-[#8B5A2B] rounded-sm mx-auto flex justify-around items-end pt-[1px] relative z-0 -mt-[1px] shadow-sm">
                                          <div className="w-[4px] h-[3px] bg-[#4A2E12] rounded-t-[1px]"></div>
                                          <div className="w-[4px] h-[3px] bg-[#4A2E12] rounded-t-[1px]"></div>
                                          <div className="w-[4px] h-[3px] bg-[#4A2E12] rounded-t-[1px]"></div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="w-[88%] bg-slate-950 rounded-lg py-1.5 flex flex-col items-center justify-center mb-1.5 border border-white/5 shadow-inner px-1">
                                      <span className="text-[10px] leading-tight font-normal text-white tracking-widest truncate max-w-full">{sku}</span>
                                      <span className="text-[9px] leading-tight text-slate-400 font-light whitespace-nowrap">{qty.toLocaleString('pt-BR')} un</span>
                                    </div>
                                  </motion.div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center w-full h-full gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                    {isEditModeActive ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAddingCoords({ lvl, d })
                                        }}
                                        className="add-pallete-btn h-10 w-10 flex items-center justify-center bg-blue-600 rounded-full text-white shadow-lg hover:scale-110 hover:bg-blue-500 transition-all cursor-pointer opacity-100 ring-4 ring-blue-500/20"
                                      >
                                        <span className="text-2xl font-light mb-1">+</span>
                                      </button>
                                    ) : (
                                      <span className="text-[8px] font-light text-slate-500 uppercase tracking-widest group-hover:opacity-25 text-center px-1">VAZIO</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="self-stretch flex flex-col items-center justify-center pl-6 mb-8">
                   <div className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                      <ArrowLeft size={18} className="text-white" />
                      <span className="text-[10px] font-light uppercase tracking-[0.3em] text-white">FRENTE</span>
                   </div>
                </div>
              </div>

              <div className="flex gap-1.5 md:gap-4 ml-8 md:ml-14 mb-2 md:mb-4">
                {depths.map(d => (
                  <div key={`head-${d}`} className="w-20 sm:w-28 md:w-28 shrink-0 text-center">
                    <span className="text-[11px] font-light text-white uppercase tracking-tighter">
                      {d}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex ml-8 md:ml-14 pt-2 border-t border-slate-800">
                 <div className="flex-1 flex justify-center">
                    <span className="text-[9px] font-light text-slate-500 uppercase tracking-widest">PROFUNDIDADE</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full lg:w-80 shrink-0"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl sticky top-4 space-y-5">
            {selectedProduct ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-medium text-blue-400 uppercase tracking-widest mb-0.5 block">Célula Selecionada</span>
                    <h3 className="text-xl font-normal text-white uppercase tracking-tighter">
                      N{selectedCoords ? selectedCoords.lvl : ""} • P{selectedCoords ? selectedCoords.d : ""}
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    {isEditModeActive && (
                      <button 
                        onClick={() => handleMoveCellToFloor(selectedProduct?.id ? [selectedProduct] : grid[selectedCoords!.lvl][selectedCoords!.d])}
                        className="px-3 py-1 bg-rose-500/10 text-rose-400 text-[10px] font-semibold rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition-colors uppercase tracking-tight"
                      >
                        Esvaziar
                      </button>
                    )}
                    <button 
                      onClick={() => setSelectedCoords(null)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                      <Lock size={14} />
                    </button>
                  </div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                  {selectedCellProducts.map((p, idx) => (
                    <div key={idx} className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-normal text-white font-mono">{p.sku}</span>
                          <p className="text-[10px] text-slate-400 italic line-clamp-1">{p.descricao}</p>
                        </div>
                        <span className="text-xs font-light text-blue-400">{Math.round(p.quantidade)} un</span>
                      </div>
                      {isEditModeActive && (
                        <div className="flex gap-2 pt-1 border-t border-slate-700/50 justify-end">
                          <button 
                            onClick={() => setEditingProduct({ ...p, _original_nivel: p.nivel, _original_profundidade: p.profundidade })}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-[10px] font-light uppercase tracking-wider flex items-center gap-1"
                          >
                            <Edit2 size={11} /> Editar
                          </button>
                          <button 
                            onClick={() => handleMoveItemToFloor(p)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 text-[10px] font-light uppercase tracking-wider flex items-center gap-1"
                          >
                            <Trash2 size={11} /> Remover
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setSelectedCoords(null)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-light uppercase text-[10px] tracking-widest transition-all"
                >
                  Fechar Detalhes
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-0.5 block">Dashboard de Posição</span>
                  <h3 className="text-xl font-normal text-white uppercase tracking-tighter">
                    {positionId || "Drive-In"}
                  </h3>
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Ocupação</span>
                      <span className="text-lg font-normal text-white">
                        {totalPallets} <span className="text-[11px] text-slate-400">/ {capacity} PTs</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((totalPallets / capacity) * 100, 100)}%` }}
                        className={cn(
                          "h-full rounded-full transition-colors",
                          (totalPallets / capacity) > 0.9 ? "bg-red-500" : "bg-blue-500"
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-light text-slate-400 uppercase tracking-widest">Total SKUs</span>
                        <span className={cn(
                          "text-[8px] font-light px-1.5 py-0.5 rounded uppercase",
                          isMixed ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        )}>
                          {isMixed ? "Misturado" : "Mono"}
                        </span>
                      </div>
                      <p className="text-2xl font-light text-white">{uniqueSkus}</p>
                    </div>

                    <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-800">
                      <span className="text-[9px] font-light text-slate-400 uppercase tracking-widest block mb-1">Unidades Físicas</span>
                      <p className="text-2xl font-light text-white">{totalQty.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>

                  <p className="text-[9px] text-center font-normal text-slate-500 uppercase tracking-widest animate-pulse pt-2">
                    Selecione uma célula p/ detalhes
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isEditModeActive && selectedGaps.size > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] w-[95vw] max-w-xl px-4"
          >
            <div className="bg-slate-900 shadow-2xl rounded-2xl p-3 border border-slate-700 flex items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-4 pl-2 border-r border-slate-800 pr-6">
                <div className="h-10 w-10 rounded-xl bg-orange-600 flex items-center justify-center text-white font-light shadow-lg">
                  {selectedGaps.size}
                </div>
                <div>
                  <h4 className="text-xs font-light text-white tracking-tight leading-none">Grades Selecionadas</h4>
                  <p className="text-[8px] font-light text-slate-400 uppercase tracking-widest mt-1">Ação em lote</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const first = Array.from(selectedGaps)[0];
                    const [lvl, d] = first.split('-').map(Number);
                    setAddingCoords({ lvl, d });
                  }}
                  className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-light uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer"
                >
                  <PlusSquare size={16} /> Adicionar em Lote
                </button>
                <button
                  onClick={handleBatchMoveToFloor}
                  className="h-10 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white text-[10px] font-light uppercase tracking-widest transition-all flex items-center gap-2 border border-rose-500/30 cursor-pointer"
                >
                  <Trash2 size={16} /> Esvaziar
                </button>
                <button
                  onClick={() => setSelectedGaps(new Set())}
                  className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {editingProduct && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 p-6 rounded-3xl max-w-sm w-full shadow-2xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-normal text-white uppercase tracking-tight">Editar Item</h3>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-light text-slate-400 uppercase">Quantidade</label>
                <input 
                  type="number" 
                  value={editingProduct.quantidade} 
                  onChange={e => setEditingProduct({...editingProduct, quantidade: Number(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm font-normal outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-light text-slate-400 uppercase">Nível</label>
                  <input 
                    type="number" 
                    value={editingProduct.nivel} 
                    onChange={e => setEditingProduct({...editingProduct, nivel: Number(e.target.value)})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs font-normal outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-light text-slate-400 uppercase">Profundidade</label>
                  <input 
                    type="number" 
                    value={editingProduct.profundidade} 
                    onChange={e => setEditingProduct({...editingProduct, profundidade: Number(e.target.value)})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs font-normal outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditingProduct(null)} 
                  className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-normal text-xs uppercase shadow-lg shadow-blue-600/30"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddPalletModal 
         isOpen={!!addingCoords}
         onClose={() => setAddingCoords(null)}
         onSave={handleModalSave}
         availableStocks={availableStocks}
         nextId={nextPalletId}
         destinationLevel={addingCoords?.lvl ?? null}
         destinationDepth={addingCoords?.d ?? null}
         selectedSlotsCount={
           addingCoords && selectedGaps.size > 0 && selectedGaps.has(`${addingCoords.lvl}-${addingCoords.d}`)
             ? selectedGaps.size
             : 1
         }
         ignoreStockValidation={ignoreStockValidation}
      />

      {removeTargetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <h3 className="text-base font-normal text-white flex items-center gap-2">
              <Trash2 className="text-rose-500" size={18} />
              {removeTargetModal.title}
            </h3>
            <p className="text-xs text-slate-300">Para onde deseja enviar o saldo?</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => removeTargetModal.onConfirm('Chão')}
                className="p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-semibold text-[10px] flex flex-col items-center gap-2"
              >
                <Package size={18} />
                <span>Chão</span>
              </button>
              <button
                onClick={() => removeTargetModal.onConfirm('Retrabalho')}
                className="p-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 font-semibold text-[10px] flex flex-col items-center gap-2"
              >
                <RefreshCw size={18} />
                <span>Retrabalho</span>
              </button>
              <button
                onClick={() => removeTargetModal.onConfirm('Eliminar')}
                className="p-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold text-[10px] flex flex-col items-center gap-2"
              >
                <Trash2 size={18} />
                <span>Eliminar</span>
              </button>
            </div>
            <button onClick={() => setRemoveTargetModal(null)} className="w-full py-2 text-xs text-slate-400 hover:text-white">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
