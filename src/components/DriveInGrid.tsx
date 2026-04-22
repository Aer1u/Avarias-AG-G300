"use client"

import React from "react"
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
  qtd_tombada: number
  qtd_molhado: number
  id_palete?: string
  id?: number | string
  fracao_paletes?: number
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
  setPendingChanges
}: DriveInGridProps) {
  const [selectedCoords, setSelectedCoords] = React.useState<{ lvl: number; d: number } | null>(null)
  const [draggingCoords, setDraggingCoords] = React.useState<{ lvl: number; d: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  // LocalProduct extends Product to track original coordinates for the swap/save logic
  const [localProducts, setLocalProducts] = React.useState<LocalProduct[]>(products.map(p => ({ ...p, _original_nivel: p.nivel, _original_profundidade: p.profundidade })))
  // Ref to block re-sync from parent when the update was triggered by an internal swap
  const isInternalSwap = React.useRef(false)
  // Ref to block the spurious onClick that fires after a drag-and-drop gesture ends
  const justDragged = React.useRef(false)

  React.useEffect(() => {
    // Skip sync if this render was caused by our own setPendingChanges (internal swap)
    if (isInternalSwap.current) {
      isInternalSwap.current = false
      return
    }
    setLocalProducts(products.map(p => ({ ...p, _original_nivel: p.nivel, _original_profundidade: p.profundidade })))
  }, [products])

  // Bulletproof cleanup: if dragging stops for any reason, thoroughly scrub out the DOM hover classes before paint
  React.useLayoutEffect(() => {
    if (!draggingCoords) {
      document.querySelectorAll('.drop-target-active').forEach(node => {
        node.classList.remove('drop-target-active')
      })
      document.body.classList.remove('grid-is-dragging')
    }
  }, [draggingCoords])
  
  // Edit State
  const [isEditModeActive, setIsEditModeActive] = React.useState(false)
  const [selectedGaps, setSelectedGaps] = React.useState<Set<string>>(new Set())
  const [addingCoords, setAddingCoords] = React.useState<{ lvl: number; d: number } | null>(null)
  const [editingProduct, setEditingProduct] = React.useState<LocalProduct | null>(null)
  const [isSelectingProductToEdit, setIsSelectingProductToEdit] = React.useState(false)

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
      .map(row => {
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
      // If we have multi-selection active and the starting addingCoords is part of it, 
      // we apply the SAME addition to ALL selected slots.
      const targetKeys = selectedGaps.size > 0 && selectedGaps.has(`${addingCoords.lvl}-${addingCoords.d}`)
        ? Array.from(selectedGaps)
        : [`${addingCoords.lvl}-${addingCoords.d}`];

      const batchMixId = targetKeys.length > 1 ? await getNextPalletIdFromDB() : null;
      let mixIdCounter = 0;

      const newPendingChanges: any[] = [];
      let index = 0;

      for (const key of targetKeys) {
        const [targetLvl, targetD] = key.split('-').map(Number);
        
        // ... (slotExistingMixId logic kept if we want to guess the ID locally, 
        // but for simplicity let's just use what's passed or generate one)
        
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
            'Parte Tombada': typeof item.qtyTilted === 'number' ? item.qtyTilted : 0,
            'Parte Molhada': typeof item.qtyWet === 'number' ? item.qtyWet : 0,
            'Id Palete': finalId,
            // Sync with page.tsx reactive keys
            posicao: positionId,
            produto: item.sku,
            descricao: item.descricao || "Produto Adicionado",
            quantidade_total: typeof item.qty === 'number' ? item.qty : 0,
            nivel: targetLvl,
            profundidade: targetD,
            qtd_tombada: typeof item.qtyTilted === 'number' ? item.qtyTilted : 0,
            qtd_molhado: typeof item.qtyWet === 'number' ? item.qtyWet : 0,
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

    if (!window.confirm(`Mover ${itemsToMove.length} itens (de ${selectedGaps.size} grades) para o Chão?`)) return;

    setIsSubmitting(true);
    try {
      const newDeleteChanges = itemsToMove.map(p => ({
        id: p.id,
        type: 'DELETE',
        payload: {
          id: p.id,
          'Código': p.sku,
          'Quantidade': p.quantidade,
          'Parte Tombada': p.qtd_tombada || 0,
          'Parte Molhada': p.qtd_molhado || 0,
          sku: p.sku,
          quantidade_total: p.quantidade
        },
        audit: {
          acao: 'REMOVER',
          sku: p.sku,
          posicao: positionId,
          nivel: p.nivel,
          profundidade: p.profundidade,
          quantidade: p.quantidade
        }
      }));

      setPendingChanges(prev => [...prev, ...newDeleteChanges]);
      setSelectedGaps(new Set());
    } catch (err) {
      console.error("Batch Move Error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }


  // 1. Generate range of levels based on total height
  // If levelCount=4, we want [3, 2, 1, 0] to include floor and 3 shelves (labeled 4, 3, 2, 1)
  const levels = React.useMemo(() => Array.from({ length: levelCount }, (_, i) => i).sort((a, b) => b - a), [levelCount]);

  const { depths, maxDepth, grid } = React.useMemo(() => {
    // Calculate max depth
    const dataDepths = Array.from(new Set(localProducts.map(p => {
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
      const levelProducts = localProducts.filter(p => p.nivel === lvl)
      
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
      const fractionals: LocalProduct[] = []
      const wholePallets: LocalProduct[] = []

      remainingProducts.forEach(p => {
        if (p.id_palete) {
          if (!groupedById.has(p.id_palete)) groupedById.set(p.id_palete, [])
          groupedById.get(p.id_palete)!.push(p)
        } else if (p.paletes > 0 && p.paletes < 0.99) {
          fractionals.push(p)
        } else {
          wholePallets.push(p)
        }
      })

      const finalGroups: LocalProduct[][] = Array.from(groupedById.values())
      
      let currentGroup: LocalProduct[] = []
      let currentSum = 0
      fractionals.forEach(p => {
        currentGroup.push(p)
        currentSum += p.paletes
        if (currentSum >= 0.95) {
          finalGroups.push(currentGroup)
          currentGroup = []
          currentSum = 0
        }
      })
      if (currentGroup.length > 0) finalGroups.push(currentGroup)
      wholePallets.forEach(p => finalGroups.push([p]))

      let currentDepth = 1
      finalGroups.forEach(group => {
        const totalPallets = group.reduce((sum, p) => sum + p.paletes, 0)
        let cellsNeeded = Math.max(1, Math.round(totalPallets))
        
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
  }, [localProducts, levels, capacity, levelCount]);

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

      setPendingChanges(prev => [...prev, {
        id: rowIdToUpdate,
        type: 'UPDATE',
        payload: {
          id: rowIdToUpdate,
          'Quantidade': newQty,
          'Nível': parseFloat(String(editingProduct.nivel)),
          'Profundidade': editingProduct.profundidade,
          'Parte Tombada': parseFloat(String(editingProduct.qtd_tombada)),
          'Parte Molhada': parseFloat(String(editingProduct.qtd_molhado)),
          'Id Palete': editingProduct.id_palete,
          // Sync with page.tsx reactive keys
          sku: editingProduct.sku,
          quantidade_total: newQty,
          nivel: parseFloat(String(editingProduct.nivel)),
          profundidade: editingProduct.profundidade,
          qtd_tombada: parseFloat(String(editingProduct.qtd_tombada)),
          qtd_molhado: parseFloat(String(editingProduct.qtd_molhado)),
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

      setEditingProduct(null);
    } catch (err) {
      console.error("Error saving edit:", err);
    } finally {
      setIsSubmitting(false);
    }
  }


  const handleMoveItemToFloor = async (product: Product) => {
    if (!product.id) {
       console.error('[Lixeira] Item sem ID:', product);
       alert("Erro: Este item não possui ID no banco de dados. Recarregue a página.");
       return;
    }

    if (!window.confirm(`Mover ${product.sku} (qtd: ${product.quantidade}) para o Chão?`)) return;

    setIsSubmitting(true);
    try {
      setPendingChanges(prev => [...prev, {
        id: product.id,
        type: 'DELETE',
        payload: {
          id: product.id,
          'Código': product.sku,
          'Quantidade': product.quantidade,
          'Parte Tombada': product.qtd_tombada || 0,
          'Parte Molhada': product.qtd_molhado || 0,
          sku: product.sku,
          quantidade_total: product.quantidade
        },
        audit: {
          acao: 'REMOVER',
          sku: product.sku,
          posicao: positionId,
          nivel: product.nivel,
          profundidade: product.profundidade,
          quantidade: product.quantidade
        }
      }]);
    } catch (err: any) {
      console.error('[Lixeira] Erro inesperado:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveCellToFloor = async (prods: Product[]) => {
    if (prods.length === 0) return;
    const validProds = prods.filter(p => p.id);
    if (validProds.length === 0) {
      alert("Erro: Nenhum item desta célula possui ID válido no banco de dados.");
      return;
    }
    if (!window.confirm(`Esvaziar Célula: Mover todos os ${validProds.length} itens para o Chão?`)) return;

    setIsSubmitting(true);
    try {
      const newDeleteChanges = validProds.map(p => ({
        id: p.id,
        type: 'DELETE',
        payload: {
          id: p.id,
          'Código': p.sku,
          'Quantidade': p.quantidade,
          'Parte Tombada': p.qtd_tombada || 0,
          'Parte Molhada': p.qtd_molhado || 0,
          sku: p.sku,
          quantidade_total: p.quantidade
        },
        audit: {
          acao: 'REMOVER',
          sku: p.sku,
          posicao: positionId,
          nivel: p.nivel,
          profundidade: p.profundidade,
          quantidade: p.quantidade
        }
      }));

      setPendingChanges(prev => [...prev, ...newDeleteChanges]);
    } catch (err) {
      console.error("Move Cell Error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleSwap = (source: { lvl: number; d: number }, target: { lvl: number; d: number }) => {
    if (source.lvl === target.lvl && source.d === target.d) return
    
    const sourceProducts = localProducts.filter(p => p.nivel === source.lvl && p.profundidade === source.d);
    const targetProducts = localProducts.filter(p => p.nivel === target.lvl && p.profundidade === target.d);

    if (sourceProducts.length === 0 && targetProducts.length === 0) return;

    // Visual Update
    const newProducts = [...localProducts].map(p => {
      if (p.nivel === source.lvl && p.profundidade === source.d) {
        return { ...p, nivel: target.lvl, profundidade: target.d }
      }
      if (p.nivel === target.lvl && p.profundidade === target.d) {
        return { ...p, nivel: source.lvl, profundidade: source.d }
      }
      return p
    })
    setLocalProducts(newProducts)

    // Stage Changes
    const newChanges: any[] = [];
    
    // Items moving to TARGET
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

    // Items moving back to SOURCE (if any)
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

    // Mark as internal so the useEffect doesn't overwrite localProducts on the next render
    isInternalSwap.current = true

    // Use startTransition so the visual swap (setLocalProducts above) renders first
    // and the expensive parent re-render (effectiveData + stats) happens at lower priority
    React.startTransition(() => {
      // Smart consolidation: instead of stacking, merge into existing pending changes.
      // If the item returns to its DB-original position, the pending change is cancelled (removed).
      setPendingChanges(prev => {
        let next = [...prev];

        for (const change of newChanges) {
          const itemId = String(change.id);
          const existingIdx = next.findIndex(c => String(c.id) === itemId && c.type === 'UPDATE');

          const localItem = localProducts.find(p => String(p.id) === itemId);
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
    });
  }

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 dark:bg-slate-800/10 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
        <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <Lock size={32} />
        </div>
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Drive Bloqueado</h3>
        <p className="text-xs font-bold text-slate-400 uppercase mt-2">{observation || "Sem observações"}</p>
      </div>
    )
  }

  const selectedCellProducts = selectedCoords ? grid[selectedCoords.lvl][selectedCoords.d] : []
  const selectedProduct = selectedCellProducts[0] || null

  // Aggregated Position Stats - Use localProducts for reactivity
  const { totalQty, totalPallets, uniqueSkus, isMixed } = React.useMemo(() => {
    const tQty = localProducts.reduce((sum, p) => sum + p.quantidade, 0)
    const tPallets = localProducts.reduce((sum, p) => sum + p.paletes, 0)
    const uSkus = new Set(localProducts.map(p => p.sku)).size
    return {
      totalQty: tQty,
      totalPallets: tPallets,
      uniqueSkus: uSkus,
      isMixed: uSkus > 1
    }
  }, [localProducts])

  // Cell Specific Stats
  const { cellUniqueSkus, isCellMixed, cellTotalQty } = React.useMemo(() => {
    const u = new Set(selectedCellProducts.map(p => p.sku)).size
    const q = selectedCellProducts.reduce((sum, p) => sum + p.quantidade, 0)
    return {
      cellUniqueSkus: u,
      isCellMixed: u > 1,
      cellTotalQty: q
    }
  }, [selectedCellProducts])

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
            className="absolute inset-0 z-[100] bg-white/20 dark:bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-[2.5rem]"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
              <RefreshCw className="animate-spin text-blue-600" size={32} />
              <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Efetuando Troca...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Unified Edit Bar intentionally removed to simplify workflow */}
      <div className="w-full flex flex-col lg:flex-row gap-8 pb-4 relative">
      {/* Grid Section */}
      <div className="flex-1 overflow-x-auto custom-scrollbar pt-2">
        <div className="flex flex-col items-center min-w-full p-4">
          <div className="relative inline-block">
            {/* Axis Labels Header Row (Levels Only) */}
            <div className="flex mb-4">
               <div className="w-14 shrink-0 pr-4 text-right">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    NÍVEL
                  </span>
               </div>
            </div>

            {/* Main Grid Area (Levels + Front Indicator) */}
            <div className="flex items-start">
              {/* Grid Rows: Levels */}
              <div className="space-y-4 mb-8 pr-4">
                {levels.map(lvl => {
                  const val = parseFloat(String(lvl))
                  const displayLvl = isNaN(val) ? lvl : Math.floor(val).toString()
                  
                  return (
                    <div key={`row-${lvl}`} className="flex items-center">
                      {/* Level Label (Y-Axis) */}
                      <div className="w-14 shrink-0 pr-4 text-right">
                        <span className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                          {displayLvl}
                        </span>
                      </div>

                      {/* Cells */}
                      <div className="flex gap-4">
                        {depths.map(d => {
                          const cellProducts = grid[lvl][d]
                          const isEmpty = cellProducts.length === 0
                          const isSelected = selectedCoords?.lvl === lvl && selectedCoords?.d === d
                          const hasWet = cellProducts.some(p => p.qtd_molhado > 0)
                          const hasTilted = cellProducts.some(p => p.qtd_tombada > 0)
                          const isMixedCell = new Set(cellProducts.map(p => p.sku)).size > 1
                          const sku = !isEmpty ? (isMixedCell ? `${cellProducts.length} Prods` : cellProducts[0].sku) : ""
                          const description = !isEmpty ? (isMixedCell ? "Múltiplos produtos neste palete" : cellProducts[0].descricao) : ""
                          const qty = !isEmpty ? Math.round(cellProducts.reduce((sum, p) => sum + p.quantidade, 0)) : 0
                          const isGridSelected = selectedGaps.has(`${lvl}-${d}`)
                          
                          return (
                            <div 
                              key={`cell-${lvl}-${d}`} 
                              data-grid-slot="true"
                              data-lvl={lvl}
                              data-d={d}
                              onClick={() => {
                                // Block the spurious click that fires immediately after a drag gesture
                                if (justDragged.current) return
                                if (isEditModeActive) {
                                  toggleGapSelection(lvl, d)
                                } else if (!isEmpty) {
                                  setSelectedCoords(isSelected ? null : { lvl, d })
                                }
                              }}
                              className={cn(
                                "w-28 h-28 rounded-xl border relative group flex items-center justify-center p-2 text-center transition-all duration-200 cursor-pointer",
                                isEmpty 
                                  ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
                                !draggingCoords && "hover:scale-[1.04]",
                                isSelected && "border-[3px] border-blue-600 dark:border-blue-500 z-20 scale-[1.02]",
                                isGridSelected && "border-orange-500 ring-4 ring-orange-500/10 bg-orange-50/5 dark:bg-orange-950/10 z-20",
                                (draggingCoords?.lvl === lvl && draggingCoords?.d === d) && "z-[60]"
                              )}
                            >
                              {/* Multi-Selection Indicator */}
                              {isEditModeActive && (
                                <div className="absolute top-2 right-2 z-30">
                                  {isGridSelected ? (
                                    <div className="bg-orange-500 text-white rounded-md p-0.5 shadow-sm">
                                      <Check size={12} strokeWidth={4} />
                                    </div>
                                  ) : (
                                    <div className="bg-white/50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 rounded-md p-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
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
                                    // In edit mode, prevent the drag-release click from bubbling
                                    // to the cell container and triggering toggleGapSelection
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
                                      
                                      // Clear old styling directly
                                      document.querySelectorAll('.drop-target-active').forEach(node => {
                                        node.classList.remove('drop-target-active');
                                      });

                                      if (cell) {
                                        const targetLvl = Number(cell.getAttribute('data-lvl'));
                                        const targetD = Number(cell.getAttribute('data-d'));
                                        
                                        // Ignore hover trigger if it is the element's origin slot to avoid visual glitch inside its own box
                                        if (targetLvl !== lvl || targetD !== d) {
                                          cell.classList.add('drop-target-active');
                                        }
                                      }
                                    }
                                  }}
                                  onDragEnd={(e, info) => {
                                    // Block the next click event on ANY cell (fires within ~200ms after drag)
                                    justDragged.current = true
                                    setTimeout(() => { justDragged.current = false }, 300)

                                    document.body.classList.remove('grid-is-dragging')
                                    setDraggingCoords(null)
                                    
                                    // Clear drop styles
                                    document.querySelectorAll('.drop-target-active').forEach(node => {
                                      node.classList.remove('drop-target-active');
                                    });
                                    const clientX = 'clientX' in e ? (e as any).clientX : (e as any).touches?.[0]?.clientX || (e as any).changedTouches?.[0]?.clientX;
                                    const clientY = 'clientY' in e ? (e as any).clientY : (e as any).touches?.[0]?.clientY || (e as any).changedTouches?.[0]?.clientY;
                                    
                                    if (clientX && clientY) {
                                      // Get all elements under cursor at drop point
                                      const elements = document.elementsFromPoint(clientX, clientY);
                                      // Find the first element that is a valid grid slot
                                      const cell = elements.find(el => el?.getAttribute?.('data-grid-slot') === "true");
                                      
                                      if (cell) {
                                        const targetLvl = Number(cell.getAttribute('data-lvl'));
                                        const targetD = Number(cell.getAttribute('data-d'));
                                        // Ignore swap attempt if it dropped upon itself
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
                                    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                                    opacity: 0.9
                                  }}
                                  className={cn(
                                    "w-[94%] h-[94%] rounded-xl flex flex-col items-center justify-between overflow-hidden relative transition-colors touch-none shadow-md",
                                    isEditModeActive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                                    "bg-[#1e293b]",
                                    hasWet 
                                      ? "shadow-[inset_0_0_20px_rgba(37,99,235,0.25)] border-[1.5px] border-blue-500/40" 
                                      : hasTilted
                                      ? "shadow-[inset_0_0_20px_rgba(220,38,38,0.25)] border-[1.5px] border-red-500/40"
                                      : isMixedCell
                                      ? "shadow-[inset_0_0_20px_rgba(217,119,6,0.25)] border-[1.5px] border-amber-500/40"
                                      : "shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] border-[1.5px] border-slate-700 hover:brightness-110"
                                  )}
                                >
                                  {/* Absolute Status Icons - Top Right */}
                                  <div className="absolute top-1.5 right-1.5 flex gap-1 z-20">
                                      {hasWet && (
                                          <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                                              <Droplet size={10} className="text-white fill-white" />
                                          </div>
                                      )}
                                      {hasTilted && (
                                          <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                                              <AlertCircle size={10} className="text-white fill-white" />
                                          </div>
                                      )}
                                      {isMixedCell && !hasWet && !hasTilted && (
                                          <div className="px-1.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                                              <span className="text-[8px] font-black text-white uppercase">Mix</span>
                                          </div>
                                      )}
                                  </div>

                                  {/* The 3D Box & Pallet Graphic */}
                                  <div className="flex-1 flex flex-col items-center justify-center w-full mt-2">
                                    <div className="relative group-hover:-translate-y-0.5 transition-transform duration-300 flex flex-col items-center">
                                      {/* Box */}
                                      <span className="text-[32px] drop-shadow-md inline-block relative z-10 leading-none">📦</span>
                                      {/* Subdued Pallet */}
                                      <div className="w-11 h-[5px] bg-[#8B5A2B] rounded-sm mx-auto flex justify-around items-end pt-[2px] relative z-0 -mt-[2px] shadow-sm">
                                        <div className="w-[5px] h-[3px] bg-[#4A2E12] rounded-t-[1px]"></div>
                                        <div className="w-[5px] h-[3px] bg-[#4A2E12] rounded-t-[1px]"></div>
                                        <div className="w-[5px] h-[3px] bg-[#4A2E12] rounded-t-[1px]"></div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* The Dark Information Pill */}
                                  <div className="w-[88%] bg-[#0B1120] rounded-lg py-1.5 flex flex-col items-center justify-center mb-1.5 border border-white/5 shadow-inner">
                                    <span className="text-[12px] leading-tight font-bold text-white tracking-widest">{sku}</span>
              <span className="text-[10px] leading-tight text-slate-400 font-medium">{qty.toLocaleString('pt-BR')} peças</span>
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
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest group-hover:opacity-20 text-center px-1">VAZIO</span>
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

              {/* Front indicator on the right (Minimalist) */}
              <div className="self-stretch flex flex-col items-center justify-center pl-4 mb-8">
                 <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                    <ArrowLeft size={16} className="text-slate-900 dark:text-white" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-900 dark:text-white">FRENTE</span>
                 </div>
              </div>
            </div>

            {/* Footer Row: Numeric Indicators (No P) */}
            <div className="flex gap-4 ml-14 mb-4">
              {depths.map(d => (
                <div key={`head-${d}`} className="w-28 shrink-0 text-center">
                  <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                    {d}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer Axis Label Header */}
            <div className="flex ml-14 pt-2 border-t border-slate-100 dark:border-slate-800/50">
               <div className="flex-1 flex justify-center">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    PROFUNDIDADE
                  </span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selection Detail Sidebar */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full lg:w-72 shrink-0 transition-all duration-500"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-[2rem] p-5 shadow-xl shadow-slate-200/40 dark:shadow-none sticky top-4">
          {selectedProduct ? (
            <div className="space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-blue-500/80 uppercase tracking-widest mb-0.5 block">
                    Célula
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                    N{selectedCoords ? selectedCoords.lvl : ""} • P{selectedCoords ? selectedCoords.d : ""}
                  </h3>
                </div>
                <div className="flex gap-2">
                  {isEditModeActive && (
                    <button 
                      onClick={() => handleMoveCellToFloor(selectedProduct?.id ? [selectedProduct] : grid[selectedCoords!.lvl][selectedCoords!.d])}
                      className="px-3 py-1 bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-[10px] font-black rounded-lg border border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 transition-colors uppercase tracking-tight"
                      title="Mover tudo para o Chão"
                    >
                      Esvaziar
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedCoords(null)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <Lock size={14} className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                  </button>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/50">
                      <th className="py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest w-[45%]">Produto</th>
                      <th className="py-2 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Qtd / Palete</th>
                      <th className="py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {selectedCellProducts.map((p, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 pr-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900 dark:text-white leading-none mb-1">{p.sku}</span>
                            <span className="text-[9px] text-slate-500 font-medium line-clamp-1 italic">{p.descricao}</span>
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                              {Math.round(p.quantidade)} <span className="text-[8px] opacity-40 font-bold uppercase">Un</span>
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">
                              {Number(p.fracao_paletes !== undefined ? p.fracao_paletes : p.paletes).toFixed(2).replace(/\.?0+$/, '')} PT
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex gap-1 justify-end min-h-[32px]">
                            {isEditModeActive && (
                              <>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditingProduct({ ...p, _original_nivel: p.nivel, _original_profundidade: p.profundidade }); }}
                                  className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:scale-110 transition-all shadow-sm"
                                  title="Editar"
                                >
                                  <Edit2 size={12} strokeWidth={3} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleMoveItemToFloor(p); }}
                                  className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 hover:scale-110 transition-all shadow-sm"
                                  title="Mover para o Chão"
                                >
                                  <Trash2 size={12} strokeWidth={3} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                <button 
                  onClick={() => setSelectedCoords(null)}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 mt-4"
                >
                  Fechar Detalhes
                </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 block">
                  Dashboard de Posição
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                  {positionId || "Drive-In"}
                </h3>
              </div>

              {/* Minimalist Summary Grid */}
              <div className="space-y-5">
                {/* Integrated Occupation */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ocupação</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      {totalPallets} <span className="text-[11px] text-slate-400 font-bold">/ {capacity} PTs</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((totalPallets / capacity) * 100, 100)}%` }}
                      className={cn(
                        "h-full rounded-full transition-colors",
                        (totalPallets / capacity) > 0.9 ? "bg-red-500" : "bg-blue-600"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total SKUs</span>
                      <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded uppercase",
                        isMixed ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {isMixed ? "Misturado" : "Mono"}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{uniqueSkus}</p>
                  </div>

                  <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Unidades Físicas</span>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{totalQty.toLocaleString('pt-BR')}</p>
                  </div>
                </div>

                <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest animate-pulse pt-2">
                  Selecione p/ mais detalhes
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Batch Action Bar - Only in Edit Mode */}
      <AnimatePresence>
        {isEditModeActive && selectedGaps.size > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[130] w-full max-w-xl px-4"
          >
            <div className="bg-slate-900 shadow-2xl rounded-2xl p-3 border border-white/10 flex items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-4 pl-4 border-r border-white/10 pr-6">
                <div className="h-10 w-10 rounded-xl bg-orange-600 flex items-center justify-center text-white font-black shadow-lg shadow-orange-500/30">
                  {selectedGaps.size}
                </div>
                <div>
                  <h4 className="text-xs font-black text-white tracking-tight leading-none">Grades Selecionadas</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Ação em lote</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const first = Array.from(selectedGaps)[0];
                    const [lvl, d] = first.split('-').map(Number);
                    setAddingCoords({ lvl, d });
                  }}
                  className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <PlusSquare size={16} /> Adicionar em Lote
                </button>
                <button
                  onClick={handleBatchMoveToFloor}
                  className="h-10 px-4 rounded-xl bg-white/10 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10"
                >
                  <Trash2 size={16} /> Esvaziar
                </button>
                <button
                  onClick={() => setSelectedGaps(new Set())}
                  className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* MODAL DE SENHA E EDIÇÃO/ADIÇÃO */}
      {(isSelectingProductToEdit || editingProduct) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm rounded-none">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            {isSelectingProductToEdit && !editingProduct ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">Qual Item Editar?</h3>
                  <button type="button" onClick={() => setIsSelectingProductToEdit(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-black text-[10px] uppercase">X Fechar</button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {products.map((p, idx) => (
                    <button
                      key={`${p.sku}-${idx}`}
                      onClick={() => setEditingProduct({ ...p, _original_nivel: p.nivel, _original_profundidade: p.profundidade })}
                      className="w-full text-left p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex justify-between items-center"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-200">{p.sku}</span>
                      <span className="text-xs text-slate-500 font-medium">{p.quantidade} un</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : editingProduct ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">Editar Item</h3>
                  <button type="button" onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-black text-[10px] uppercase">X Fechar</button>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
                  <p className="text-xs font-black text-slate-500 uppercase">Item atual</p>
                  <p className="font-bold text-slate-900 dark:text-white">{editingProduct.sku}</p>
                </div>
                <div className="space-y-3">
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Nível Anterior</label>
                        <input type="text" value={editingProduct._original_nivel} disabled className="w-full text-sm bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Profundidade Anter.</label>
                        <input type="text" value={editingProduct._original_profundidade} disabled className="w-full text-sm bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-500" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Quantidade Total *</label>
                        {editingProduct && (
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                            (availableStocks.find(s => s.produto === editingProduct.sku)?.available || 0) > 0 
                              ? "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" 
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                          )}>
                            Chão: {availableStocks.find(s => s.produto === editingProduct.sku)?.available || 0}
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={editingProduct.quantidade || ""} 
                        onChange={e => setEditingProduct({...editingProduct, quantidade: Math.floor(Number(e.target.value))})} 
                        className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white font-bold" 
                        required 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Qtd Tombada</label>
                        <input type="number" value={editingProduct.qtd_tombada || ""} onChange={e => setEditingProduct({...editingProduct, qtd_tombada: Math.floor(Number(e.target.value))})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Qtd Molhado</label>
                        <input type="number" value={editingProduct.qtd_molhado || ""} onChange={e => setEditingProduct({...editingProduct, qtd_molhado: Math.floor(Number(e.target.value))})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Novo Nível *</label>
                        <input type="number" value={editingProduct.nivel ?? ""} onChange={e => setEditingProduct({...editingProduct, nivel: Number(e.target.value)})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-blue-500 p-2 rounded-lg text-slate-900 dark:text-white font-bold" required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Nova Profundidade *</label>
                        <input type="number" value={editingProduct.profundidade ?? ""} onChange={e => setEditingProduct({...editingProduct, profundidade: Number(e.target.value)})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-blue-500 p-2 rounded-lg text-slate-900 dark:text-white font-bold" required />
                      </div>
                    </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full mt-4 p-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50">
                  {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal de Adição Novo */}
      <AddPalletModal 
         isOpen={!!addingCoords}
         onClose={() => setAddingCoords(null)}
         onSave={handleModalSave}
         availableStocks={availableStocks}
         nextId={nextPalletId}
         destinationLevel={addingCoords?.lvl ?? null}
         destinationDepth={addingCoords?.d ?? null}
      />
    </div>
  )
}
