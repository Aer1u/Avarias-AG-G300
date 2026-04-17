"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Package,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  Search,
  RefreshCw,
  Check,
  Download,
  AlertCircle,
  LayoutGrid,
  MapPin,
  Tag,
  ArrowDownWideNarrow,
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Flame,
  PieChart,
  Info,
  Layers,
  Zap,
  Trash2,
  Star,
  Activity,
  Box,
  Layout,
  Menu,
  X,
  Droplet,
  Table as TableIcon,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Moon,
  Sun,
  FileText,
  CheckSquare,
  Printer,
  MessageSquare,
  TrendingDown,
  Minus,
  GitCompare,
  Settings,
  MoreHorizontal,
  Share2,
  DownloadCloud,
  History,
  Lock,
  Warehouse,
  User,
  LogIn,
  LogOut,
  AtSign,
  Plus,
  PlusSquare,
  AlertTriangle,
  Scissors,
  GitMerge
} from "lucide-react"
import { MetricCard } from "@/components/MetricCard"
import { WarehouseTable } from "@/components/WarehouseTable"
import { DriveInGrid } from "@/components/DriveInGrid"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import RegistrosTab from "@/components/RegistrosTab"

type ViewType = "geral" | "posicoes" | "nao_alocados" | "produtos" | "molhados"
type DisplayMode = "mapa" | "tabela" | "misto" | "nao_alocados"
type SortType = "none" | "qty_desc" | "qty_asc" | "alpha_asc"

// Auto-detect: local dev uses localhost, deployed uses Render backend
const isLocal = typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168."));

const API_BASE = isLocal
  ? `http://${window.location.hostname}:8000`
  : "https://portal-ag-g300.onrender.com"

// Helper: show 1 decimal only if value is < 1 (e.g., shared pallets like 0.5), otherwise integer
const fmtNum = (val: number, locale = 'pt-BR') =>
  val !== 0 && Math.abs(val) < 1
    ? val.toLocaleString(locale, { maximumFractionDigits: 2 })
    : Math.round(val).toLocaleString(locale)

// Standardized field access helper for inconsistent Supabase/Excel schemas
const getVal = (obj: any, keys: string[]) => {
  if (!obj) return null;
  const objKeys = Object.keys(obj);
  const foundKey = objKeys.find(k => keys.includes(k.toLowerCase()));
  return foundKey ? obj[foundKey] : null;
};

// Helper: parse Brazilian-formatted numbers ("1.000" → 1000, "1.234,56" → 1234.56)
export const parseBrNum = (val: any): number => {
  if (val === null || val === undefined || val === '' || val === false) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, '')) || 0;
  return Number(s) || 0;
};

function DashboardPage() {
  const normalizeSku = (s: string) => String(s || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const [data, setData] = useState<any[]>([])
  const [movimentosRaw, setMovimentosRaw] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeView, setActiveView] = useState<ViewType>("geral")
  const [displayMode, setDisplayMode] = useState<DisplayMode>("mapa")
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null)
  const [selectedNaoAlocados, setSelectedNaoAlocados] = useState<Set<string>>(new Set())
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showUngroupConfirm, setShowUngroupConfirm] = useState(false)
  const [ungroupTargetData, setUngroupTargetData] = useState<{ id: string, itemIds: any[] } | null>(null)
  const [palletIdInput, setPalletIdInput] = useState("")
  const [isProcessingGroup, setIsProcessingGroup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [tableSort, setTableSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "posicao", direction: "asc" })
  const [sortMode, setSortMode] = useState<SortType>("none")
  const [modalFilter, setModalFilter] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [scrollRequested, setScrollRequested] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showExportConfigModal, setShowExportConfigModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<"excel" | "pdf">("excel")
  const [exportTab, setExportTab] = useState<"simple" | "advanced">("simple")
  const [exportOptions, setExportOptions] = useState({
    includeWet: true,
    includeTilted: true,
    includeTraditional: true,
    includeAllocated: true,
    includeNotAllocated: true,
    includeNormal: true,
    includeDivergent: true,
    includeRejected: true,
    includeObservations: false
  })
  const [mapMenuOpen, setMapMenuOpen] = useState(false)
  const [selectionModeActive, setSelectionModeActive] = useState(false)
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set())
  const [topTab, setTopTab] = useState<"geral" | "mapeamento" | "produtos" | "confrontos" | "registros">("geral")
  const [showDivergences, setShowDivergences] = useState(false)
  const [confrontosData, setConfrontosData] = useState<any>(null)
  const [loadingConfrontos, setLoadingConfrontos] = useState(false)
  const [errorConfrontos, setErrorConfrontos] = useState<string | null>(null)
  const [statsCache, setStatsCache] = useState<Record<string, any>>({})
  const [globalStats, setGlobalStats] = useState<any>(null)
  const [confrontosCache, setConfrontosCache] = useState<Record<string, any>>({})
  const [confrontoFilter, setConfrontoFilter] = useState<"all" | "divergent" | "match" | "excess" | "missing" | "adjusted">("all")
  const [confrontoSearch, setConfrontoSearch] = useState("")
  const [confrontoSortDir, setConfrontoSortDir] = useState<"asc" | "desc">("asc")
  const [confrontoType, setConfrontoType] = useState<"fisico_x_a501" | "a501_x_g501">("fisico_x_a501")
  const [exportFilter, setExportFilter] = useState<"tudo" | "positivado" | "negativado" | "batendo" | "divergente">("tudo")
  const [selectedConfrontoItem, setSelectedConfrontoItem] = useState<any>(null)
  const [confrontoCurrentPage, setConfrontoCurrentPage] = useState(1)
  const confrontoItemsPerPage = 10
  const [topSkusFilter, setTopSkusFilter] = useState<"geral" | "molhado" | "incidencia">("geral")
  const [topSkusSort, setTopSkusSort] = useState<"quantidade" | "incidencia">("quantidade")
  const [showTopSkusMenu, setShowTopSkusMenu] = useState(false)
  const [movementPeriod, setMovementPeriod] = useState<"hoje" | "semana" | "mensal">("hoje")
  const [showMovementMenu, setShowMovementMenu] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [blinkPosition, setBlinkPosition] = useState<string | null>(null)
  const [positionViewMode, setPositionViewMode] = useState<"tabela" | "grade">("tabela")
  const [mixedSort, setMixedSort] = useState<"name_asc" | "name_desc" | "sku_asc" | "sku_desc">("name_asc")
  const [palletTrend, setPalletTrend] = useState<number | undefined>(undefined)
  const [palletHistory, setPalletHistory] = useState<{ t14: number, t17: number, t22: number, prevT22: number }>({ t14: 0, t17: 0, t22: 0, prevT22: 0 })
  const [palletHistoryFilter, setPalletHistoryFilter] = useState<'hoje' | 'dias'>('hoje')
  const [dailyHistoryRecords, setDailyHistoryRecords] = useState<{ date: string, value: number }[]>([])

  const [baseCodigosMap, setBaseCodigosMap] = useState<Map<string, any>>(new Map())
  const [mergeQuantities, setMergeQuantities] = useState<Record<string, number | string>>({})

  const surplusDivergences = useMemo(() =>
    stats?.divergences?.filter((d: any) => d.diff > 0) || [],
    [stats?.divergences]
  )
  const missingDivergences = useMemo(() =>
    stats?.divergences?.filter((d: any) => d.diff < 0) || [],
    [stats?.divergences]
  )

  // -- HIERARQUIA DE PALETES (Chão) --
  const [expandedPallets, setExpandedPallets] = useState<Set<string>>(new Set())
  const togglePallet = (key: string) => setExpandedPallets(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })



  // -- DRAG AND DROP PALETES --
  const [draggedItem, setDraggedItem] = useState<any>(null)
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferPayload, setTransferPayload] = useState<{
    sourceItem: any;
    targetId: string | null; // null => desagrupar, ID => group, 'NEW' => criar novo mix
    targetType: 'mix' | 'ungroup' | 'new_mix' | 'new_standalone_mix';
    targetBaseItem?: any;
  } | null>(null)
  const [transferQuantity, setTransferQuantity] = useState<string>("")
  const [isTransferring, setIsTransferring] = useState(false)

  // -- DIVIDIR / JUNTAR PALETES --
  const [splitModalOpen, setSplitModalOpen] = useState(false)
  const [splitTarget, setSplitTarget] = useState<any>(null)
  const [splitQtyPerPallet, setSplitQtyPerPallet] = useState("")
  const [isSplitting, setIsSplitting] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeTarget, setMergeTarget] = useState<{ sku: string; items: any[] } | null>(null)
  const [isMerging, setIsMerging] = useState(false)
  const [selectedMergeIds, setSelectedMergeIds] = useState<Set<any>>(new Set())

  // -- ADICIONAR ITEM NO CHÃO --
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)
  const [isCreatingItem, setIsCreatingItem] = useState(false)
  const [newItemData, setNewItemData] = useState({
    produto: "",
    quantidade: "",
    observacao: ""
  })

  const handleDragStart = (e: React.DragEvent, item: any) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('application/json', JSON.stringify(item.id))
  }

  const handleDragEnd = (e: React.DragEvent) => {
    // Só limpamos o estado visual se o drag foi cancelado (dropEffect === 'none')
    // Se houve um drop válido, o próprio Modal ou a confirmação limparão o estado.
    if (e.dataTransfer.dropEffect === 'none') {
      setDraggedItem(null)
    }
    setDragOverTarget(null)
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverTarget(targetId)
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverTarget(null)
  }

  const handleDrop = (e: React.DragEvent, targetType: 'mix' | 'ungroup' | 'new_mix' | 'new_standalone_mix', targetId: string | null, targetBaseItem?: any) => {
    e.preventDefault()
    setDragOverTarget(null)
    if (!draggedItem) return

    // Se n‹o houver mudana v‡lida
    if (draggedItem.id === targetBaseItem?.id) return
    if (targetType === 'mix' && draggedItem.id_palete === targetId) return
    if (targetType === 'ungroup' && !draggedItem.id_palete) return

    setTransferPayload({ sourceItem: draggedItem, targetId, targetType, targetBaseItem })
    setTransferQuantity(draggedItem.quantidade_total?.toString() || "0")
    setTransferModalOpen(true)
  }

  const getNextPalletId = async () => {
    const { data: latestRows } = await supabase.from('mapeamento').select('"Id Palete"').not('"Id Palete"', 'is', null)
    const usedNumbers = new Set<number>()
    latestRows?.forEach((row: any) => {
      const idStr = String(row['Id Palete'] || "").trim()
      if (idStr.toUpperCase().startsWith("P.")) {
        const num = parseInt(idStr.substring(2).trim(), 10)
        if (!isNaN(num)) usedNumbers.add(num)
      }
    })
    let candidate = 1
    while (usedNumbers.has(candidate)) { candidate++ }
    return `P.${candidate.toString().padStart(3, '0')}`
  }

  const handleConfirmTransfer = async () => {
    if (!transferPayload) return;
    setIsTransferring(true);
    try {
      const dbQty = parseFloat(transferPayload.sourceItem.quantidade_total || "0");
      const qtToMove = parseFloat(transferQuantity.replace(',', '.'));
      
      if (isNaN(qtToMove) || qtToMove <= 0 || qtToMove > dbQty) {
        throw new Error("Quantidade inválida ou superior ao total disponível.");
      }

      let finalTargetId = transferPayload.targetId;
      
      if (transferPayload.targetType === 'new_mix') {
         finalTargetId = await getNextPalletId();
         if (transferPayload.targetBaseItem) {
           await supabase.from('mapeamento').update({ 'Id Palete': finalTargetId }).eq('id', transferPayload.targetBaseItem.id);
         }
      } else if (transferPayload.targetType === 'new_standalone_mix') {
         finalTargetId = await getNextPalletId();
      } else if (transferPayload.targetType === 'ungroup') {
         finalTargetId = null;
      }

      if (qtToMove === dbQty) {
         // Move tudo
         const { error } = await supabase.from('mapeamento').update({ 'Id Palete': finalTargetId }).eq('id', transferPayload.sourceItem.id);
         if (error) throw error;
      } else {
         // Fracionamento de quantidade
         const src = transferPayload.sourceItem;
         const insertSource = {
            'Posição': src.posicao,
            'Id Palete': finalTargetId,
            'Código': src.produto,
            'Quantidade': qtToMove,
            'Nível': src.nivel,
            'Profundidade': src.profundidade,
            'Parte Tombada': src.qtd_tombada || 0,
            'Parte Molhada': src.qtd_molhado || 0,
            'Observação': src.observacao || null,
            'Vencimento': src.vencimento || null,
            'Lote': src.lote || null
         };
         
         const { error: insErr } = await supabase.from('mapeamento').insert(insertSource);
         if (insErr) throw insErr;
         
         const { error: updErr } = await supabase.from('mapeamento').update({ 'Quantidade': dbQty - qtToMove }).eq('id', src.id);
         if (updErr) throw updErr;
      }
      
      await fetchData();
    } catch (error: any) {
      alert(error.message || "Erro ao movimentar palete.");
    } finally {
      setIsTransferring(false);
      setTransferModalOpen(false);
      setTransferPayload(null);
      setDraggedItem(null);
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteQuantity, setDeleteQuantity] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  const executeDeleteFromChao = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const dbQty = parseFloat(deleteTarget.quantidade_total || "0");
      const qtToDelete = parseFloat(deleteQuantity.replace(',', '.'));
      
      if (isNaN(qtToDelete) || qtToDelete <= 0 || qtToDelete > dbQty) {
        throw new Error("Quantidade inválida ou superior ao total disponível.");
      }

      if (qtToDelete === dbQty) {
        const { error } = await supabase.from('mapeamento').delete().eq('id', deleteTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('mapeamento').update({ 'Quantidade': dbQty - qtToDelete }).eq('id', deleteTarget.id);
        if (error) throw error;
      }
      
      await fetchData();
    } catch (err: any) {
      alert("Erro ao excluir registro: " + (err.message || err));
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  // -- DIVIDIR PALETES --
  const handleSplitPallets = async () => {
    if (!splitTarget) return
    const totalQty = parseFloat(splitTarget.quantidade_total || splitTarget.Quantidade || "0")
    const qtyPerPallet = parseInt(splitQtyPerPallet.replace(',', '.'))

    if (isNaN(qtyPerPallet) || qtyPerPallet <= 0) {
      alert("Informe uma quantidade por palete válida.")
      return
    }
    if (qtyPerPallet >= totalQty) {
      alert("A quantidade por palete deve ser menor que a quantidade total.")
      return
    }

    setIsSplitting(true)
    try {
      const p1Qty = Math.round((totalQty - qtyPerPallet) * 1000) / 1000;
      const p2Qty = qtyPerPallet;

      const { error: updErr } = await supabase.from('mapeamento')
        .update({ 'Quantidade': p1Qty })
        .eq('id', splitTarget.id);
      if (updErr) throw updErr;

      const { error: insErr } = await supabase.from('mapeamento').insert([{
        'Código': splitTarget.produto,
        'Quantidade': p2Qty,
        'Posição': null,
        'Nível': 0,
        'Profundidade': 1,
        'Parte Tombada': 0,
        'Parte Molhada': 0,
        'Id Palete': null,
        'Observação': splitTarget.observacao || null
      }]);
      if (insErr) throw insErr;

      await fetchData()
      setSplitModalOpen(false)
      setSplitTarget(null)
      setSplitQtyPerPallet("")
    } catch (err: any) {
      alert("Erro ao dividir: " + (err.message || err));
    } finally {
      setIsSplitting(false)
    }
  }

  // -- JUNTAR OU REDISTRIBUIR PALETES DO MESMO CÓDIGO --
  const handleMergeBySku = async (isAutoForm: boolean = false) => {
    if (!mergeTarget) return
    const itemsToMerge = mergeTarget.items.filter(i => selectedMergeIds.has(i.id))
    if (itemsToMerge.length < 2 && !isAutoForm) {
      alert("Selecione pelo menos 2 paletes para movimentar.")
      return
    }

    setIsMerging(true)
    try {
      if (isAutoForm) {
        // Lógica do Auto Formar (deleta os selecionados e recria no chão pela Grade)
        let totalToAutoForm = 0;
        const allIdsToDelete = [];
        for (const item of itemsToMerge) {
           totalToAutoForm += parseFloat(item.quantidade_total) || 0;
           allIdsToDelete.push(item.id);
        }
        
        if (allIdsToDelete.length > 0) {
           const { error: delErr } = await supabase.from('mapeamento').delete().in('id', allIdsToDelete);
           if (delErr) throw delErr;
        }

        const src = itemsToMerge[0];
        const newItems = [];
        const grade = Number(baseCodigosMap.get(mergeTarget.sku)?.grade) || 0;
        if (grade > 0) {
          let remaining = totalToAutoForm;
          while (remaining > 0) {
             const qtyToInsert = Math.min(grade, remaining);
             newItems.push({
              'Código': mergeTarget.sku,
              'Quantidade': qtyToInsert,
              'Posição': src?.posicao || null,
              'Nível': src?.nivel || 0,
              'Profundidade': src?.profundidade || 1,
              'Parte Tombada': 0,
              'Parte Molhada': 0,
              'Id Palete': null,
              'Observação': src?.observacao || null
             });
             remaining = Math.round((remaining - qtyToInsert) * 1000) / 1000;
          }
        } else {
           newItems.push({
              'Código': mergeTarget.sku,
              'Quantidade': totalToAutoForm,
              'Posição': src?.posicao || null,
              'Nível': src?.nivel || 0,
              'Profundidade': src?.profundidade || 1,
              'Parte Tombada': 0,
              'Parte Molhada': 0,
              'Id Palete': null,
              'Observação': src?.observacao || null
           });
        }
        
        if (newItems.length > 0) {
            const { error: insErr } = await supabase.from('mapeamento').insert(newItems);
            if (insErr) throw insErr;
        }

      } else {
        // Lógica Distributiva ("agrupar dentro da quantidade DISPONIVEL")
        let currentTotal = 0;
        let newTotal = 0;
        const updates = [];
        const deletes = [];

        for (const item of itemsToMerge) {
          const available = parseFloat(item.quantidade_total) || 0;
          currentTotal += available;
          
          const finalQtyStr = mergeQuantities[item.id];
          let finalQty = available;
          if (finalQtyStr !== undefined && finalQtyStr !== "" && finalQtyStr !== null) {
             finalQty = parseFloat(String(finalQtyStr));
             if (isNaN(finalQty)) finalQty = 0;
          }

          newTotal += finalQty;

          if (finalQty <= 0) {
            deletes.push(item.id);
          } else if (finalQty !== available) {
            updates.push({ id: item.id, qty: finalQty });
          }
        }

        currentTotal = Math.round(currentTotal * 1000) / 1000;
        newTotal = Math.round(newTotal * 1000) / 1000;

        if (newTotal !== currentTotal) {
          alert("A quantidade total resultante deve ser igual à quantidade total selecionada: " + currentTotal);
          setIsMerging(false);
          return;
        }

        if (deletes.length > 0) {
           const { error: delErr } = await supabase.from('mapeamento').delete().in('id', deletes);
           if (delErr) throw delErr;
        }

        for (const update of updates) {
           const { error: updErr } = await supabase.from('mapeamento').update({ 'Quantidade': update.qty }).eq('id', update.id);
           if (updErr) throw updErr;
        }
      }

      await fetchData()
      setMergeModalOpen(false)
      setMergeTarget(null)
      setSelectedMergeIds(new Set())
      setMergeQuantities({})
    } catch (err: any) {
      alert("Erro ao juntar paletes: " + (err.message || err))
    } finally {
      setIsMerging(false)
    }
  }

  const handleCreateNewItem = async () => {
    if (!newItemData.produto || !newItemData.quantidade) {
      alert("SKU e Quantidade são obrigatórios.");
      return;
    }

    setIsCreatingItem(true);
    try {
      const qty = Math.round(parseFloat(newItemData.quantidade.replace(',', '.')));
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Quantidade inválida.");
      }

      const { error } = await supabase.from('mapeamento').insert({
        'Código': newItemData.produto.trim().toUpperCase(),
        'Quantidade': qty,
        'Observação': newItemData.observacao.trim() || null,
        'Posição': null,
        'Id Palete': null
      });

      if (error) throw error;

      await fetchData();
      setIsAddItemModalOpen(false);
      setNewItemData({
        produto: "",
        quantidade: "",
        observacao: ""
      });
    } catch (err: any) {
      alert("Erro ao criar item: " + (err.message || err));
    } finally {
      setIsCreatingItem(false);
    }
  }

  // -- AUTENTICAÇÍO SUPABASE --
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (!session?.user) setShowLoginModal(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (!session?.user) setShowLoginModal(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })
      if (error) throw error
      setShowLoginModal(false)
      setLoginEmail("")
      setLoginPassword("")
    } catch (err: any) {
      alert("Erro ao fazer login: " + err.message)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  type AjusteManal = {
    id: number
    produto: string
    quantidade: number
    motivo: string
    usuario: string
    timestamp: Date
  }
  const [ajustesConfronto, setAjustesConfronto] = useState<AjusteManal[]>([])
  const [modalAjusteOpen, setModalAjusteOpen] = useState(false)
  const [showAjustesMenu, setShowAjustesMenu] = useState(false)
  const [showImportarAjustesModal, setShowImportarAjustesModal] = useState(false)
  const [importarAjustesText, setImportarAjustesText] = useState("")

  // -- ESTADOS PARA IMPORTAÇÍO DE A501 (SNAPSHOT SISTEMA) --
  const [modalImportA501Open, setModalImportA501Open] = useState(false)
  const [importTextA501, setImportTextA501] = useState("")
  const [isImportingA501, setIsImportingA501] = useState(false)

  // -- ESTADOS PARA IMPORTAÇÍO DE G501 (SNAPSHOT VISTORIA) --
  const [modalImportG501Open, setModalImportG501Open] = useState(false)
  const [importTextG501, setImportTextG501] = useState("")
  const [isImportingG501, setIsImportingG501] = useState(false)

  const handleExportAjustes = () => {
    try {
      const jsonStr = JSON.stringify(ajustesConfronto)
      const encoded = btoa(encodeURIComponent(jsonStr))
      navigator.clipboard.writeText(encoded)
      alert("Código de configurações de ajuste copiado para a área de transferência com sucesso!")
      setShowAjustesMenu(false)
    } catch (e) {
      alert("Erro ao exportar configuração.")
    }
  }

  const handleImportAjustes = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!importarAjustesText.trim()) return;
      const decoded = decodeURIComponent(atob(importarAjustesText.trim()))
      const parsed = JSON.parse(decoded)
      if (Array.isArray(parsed)) {
        // Simple validation
        const valid = parsed.every(p => p.produto && typeof p.quantidade === 'number')
        if (valid) {
          setAjustesConfronto(parsed)
          setShowImportarAjustesModal(false)
          setImportarAjustesText("")
          alert("Configurações importadas com sucesso!")
        } else {
          alert("A configuração colada não é válida.")
        }
      }
    } catch (e) {
      alert("Código inválido ou corrompido.")
    }
  }

  const [rowsPerPage, setRowsPerPage] = useState<number | 'ALL'>('ALL') // Posições por página

  const handleVerNoMapa = (posId: string) => {
    setActiveView("posicoes");
    setDisplayMode("mapa");
    setTopTab("mapeamento");
    setBlinkPosition(posId);
    setScrollRequested(true);
    // Limpa o efeito após 3 segundos
    setTimeout(() => {
      setBlinkPosition(null);
    }, 3000);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" || "light"
    setTheme(savedTheme)
  }, [])

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    localStorage.setItem("theme", theme)
  }, [theme])

  useEffect(() => {
    let attempts = 0;
    let timeoutId: NodeJS.Timeout;

    const tryScroll = () => {
      if (!scrollRequested) return;

      const element = document.getElementById("warehouse-map")
      if (element) {
        // Pequeno delay extra para garantir que o layout estabilizou
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "start" })
          setScrollRequested(false)
        }, 50);
      } else if (attempts < 20) { // Tenta por até 2 segundos
        attempts++;
        timeoutId = setTimeout(tryScroll, 100);
      } else {
        setScrollRequested(false);
      }
    }

    if (scrollRequested) {
      tryScroll()
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [scrollRequested, activeView, displayMode])

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light")
  }

  const calculateStatsFromData = (allData: any[], historicoRaw: any[] = [], period: "hoje" | "semana" | "mensal" | "all" = "all", skuLookup?: Map<string, any>) => {
    // 1. Unified state for calculation
    const registrosBySku = new Map<string, number>();
    const regCountBySku = new Map<string, number>();
    const mappedDriveInBySku = new Map<string, number>();
    const chaoBySku = new Map<string, number>();
    const skuMap = new Map<string, number>();
    const frequencyMap: Record<string, number> = {};
    const molhFrequencyMap: Record<string, number> = {};
    const regIncidenceBySku: Record<string, number> = {};

    let global_entries = 0;
    let global_exits = 0;
    let period_entries = 0;
    let period_exits = 0;
    let actual_today_entries = 0;
    let actual_today_exits = 0;

    // Absolute totals including EVERYTHING (even ajuste/mapeamento)
    let absolute_entries = 0;
    let absolute_exits = 0;
    const absoluteSkusSet = new Set<string>();
    // Balance per SKU from ALL records (no origin filter) — used for pendências
    const allSkuBalance = new Map<string, number>();
    let absolute_today_net = 0;
    let absolute_yesterday_net = 0;
    const todayDate = new Date();
    const todayStr = todayDate.toISOString().split('T')[0];
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    historicoRaw.forEach(m => {
      const ent = parseBrNum(m['Entrada'] || m['entrada']);
      const sai = parseBrNum(m['Saída'] || m['saida'] || m['Saida'] || m['saída']);
      const sku = String(m['Produto'] || m['produto'] || m['Código'] || m['codigo'] || m['Codigo'] || "").trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      if (sku && sku !== "-" && sku !== "NAN") {
        absoluteSkusSet.add(sku);
        allSkuBalance.set(sku, (allSkuBalance.get(sku) || 0) + (ent - sai));
        // Global record count per SKU (Total 1,344)
        regCountBySku.set(sku, (regCountBySku.get(sku) || 0) + 1);
      }
      absolute_entries += ent;
      absolute_exits += sai;

      // Cálculo da variação real de hoje e ontem (total absoluto)
      const dataStr = m['Data'] || m['data'] || m['created_at'] || '';
      if (dataStr) {
        const d = new Date(dataStr);
        if (!isNaN(d.getTime())) {
          const dStr = d.toISOString().split('T')[0];
          if (dStr === todayStr) {
            absolute_today_net += (ent - sai);
          } else if (dStr === yesterdayStr) {
            absolute_yesterday_net += (ent - sai);
          }
        }
      }
    });

    // 2. Date calculations
    const day = todayDate.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const firstOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);


    // 3. Process Movements (Principal Source of Truth for Totals)
    const allFormattedMovements = historicoRaw.filter(m => {
      // Exclude 'ajuste' and 'mapeamento' from the chart and incidence
      const orig = String(m['Origem'] || m['origem'] || '').toLowerCase().trim();
      return !orig.includes('mapeamento') && !orig.includes('ajuste');
    }).map(m => {
      // Robust field mapping for SKU/Product
      const sku = String(m['Produto'] || m['produto'] || m['Código'] || m['codigo'] || m['Codigo'] || "").trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Robust field mapping for Quantities
      const ent = parseBrNum(m['Entrada'] || m['entrada']);
      const sai = parseBrNum(m['Saída'] || m['saida'] || m['Saida'] || m['saída']);

      const data = m['Data'] || m['data'] || m['created_at'] || '';
      const origem = m['Origem'] || m['origem'] || '-';

      if (sku && sku !== "-" && sku !== "NAN") {
        registrosBySku.set(sku, (registrosBySku.get(sku) || 0) + (ent - sai));
      }

      global_entries += ent;
      global_exits += sai;

      let isInPeriod = true;
      let isToday = false;
      if (data) {
        const d = new Date(data);
        const isValidDate = !isNaN(d.getTime());

        if (!isValidDate) {
          isInPeriod = false;
        } else {
          const isoDate = d.toISOString().split('T')[0];
          isToday = (isoDate === todayStr);
          if (period === "hoje") isInPeriod = isToday;
          else if (period === "semana") isInPeriod = d >= monday;
          else if (period === "mensal") isInPeriod = d.getFullYear() === todayDate.getFullYear();
          else isInPeriod = true;
        }
      } else {
        isInPeriod = false;
      }

      if (isToday) {
        actual_today_entries += ent;
        actual_today_exits += sai;
      }

      if (isInPeriod) {
        period_entries += ent;
        period_exits += sai;
      }

      const lookup = skuLookup?.get(sku);
      return {
        id: m.id || Math.random(),
        produto: sku,
        descricao: lookup?.descricao || 'Produto não cadastrado',
        movimentacao: ent > 0 ? ent : sai,
        entrada: ent > 0,
        entrada_val: ent,
        saida_val: sai,
        molhado: parseBrNum(m['Molhado'] || m['molhado']),
        data: data,
        tipo: ent > 0 ? 'entrada' : 'saída',
        origem: origem,
        isInPeriod: isInPeriod
      };
    }).filter(m => m.movimentacao > 0 || m.produto !== "");

    // 3.5 Calculate filtered incidence (Entries only, no Adjustment/Mapping)
    allFormattedMovements.forEach(m => {
      if (!m.isInPeriod) return;
      // Only count entries (m.entrada_val > 0)
      // Note: All movements here are already filtered to exclude 'ajuste' and 'mapeamento'
      if (m.entrada_val > 0) {
        regIncidenceBySku[m.produto] = (regIncidenceBySku[m.produto] || 0) + 1;
      }
    });

    const sortedFormattedMovements = [...allFormattedMovements].sort((a, b) => {
      if (!a.data || !b.data) return 0;
      const db = new Date(b.data).getTime();
      const da = new Date(a.data).getTime();
      return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
    });

    // 4. Process Current Mapping (How much of the total is stored)
    allData.forEach(item => {
      const sku = String(item.produto || "").trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!sku || sku === "-" || sku === "nan") return;

      const total = Number(item.quantidade_total) || 0;
      skuMap.set(sku, (skuMap.get(sku) || 0) + total);
      frequencyMap[sku] = (frequencyMap[sku] || 0) + 1;
      if (Number(item.qtd_molhado) > 0) molhFrequencyMap[sku] = (molhFrequencyMap[sku] || 0) + 1;

      if (item.is_unallocated_source) {
        chaoBySku.set(sku, (chaoBySku.get(sku) || 0) + total);
      } else {
        mappedDriveInBySku.set(sku, (mappedDriveInBySku.get(sku) || 0) + total);
      }
    });

    // 5. Compute Final Availability and Registration Divergences
    const unregisteredPositions = new Set<string>();
    allData.forEach(item => {
      if (item.is_unregistered) unregisteredPositions.add(item.posicao);
    });

    const allSkus = new Set([...registrosBySku.keys(), ...chaoBySku.keys(), ...mappedDriveInBySku.keys()]);
    const divergences = Array.from(allSkus).map(sku => {
      const systemTotal = registrosBySku.get(sku) || 0;
      const inChao = chaoBySku.get(sku) || 0;
      const mappedDriveIn = mappedDriveInBySku.get(sku) || 0;
      const totalAvailable = Math.max(inChao, systemTotal - mappedDriveIn);

      return {
        produto: sku,
        available: totalAvailable
      };
    }).filter(d => d.available > 0);

    // Use absolute balance (allSkuBalance) for pendências and divergenciasLupa (Lupa)
    // Pendências: Total Registrado (qty) > Mapeado (qty) - temos registro, mas falta o físico
    const allSkusSet = new Set([...allSkuBalance.keys(), ...skuMap.keys()]);
    const pendencias = Array.from(allSkusSet).map(sku => {
      const regQty = allSkuBalance.get(sku) || 0;
      const mapQty = skuMap.get(sku) || 0;
      const diff = regQty - mapQty;
      return { sku, regQty, mapQty, diff };
    }).filter(p => p.diff > 0).sort((a, b) => b.diff - a.diff);

    // Divergências (Lupa): Mapeado (qty) > Total Registrado (qty) - sobra no físico, falta no registro
    const divergenciasLupa = Array.from(allSkusSet).map(sku => {
      const regQty = allSkuBalance.get(sku) || 0;
      const mapQty = skuMap.get(sku) || 0;
      const diff = mapQty - regQty;
      return { sku, regQty, mapQty, diff };
    }).filter(p => p.diff > 0).sort((a, b) => b.diff - a.diff);

    const total_drive_qty = Array.from(mappedDriveInBySku.values()).reduce((sum, v) => sum + v, 0);
    const mixed_pallets_count = 0; // Calculated via mixedPalletsData useMemo (needs data state)

    return {
      total_quantity: global_entries - global_exits, // Operational total
      absolute_total_quantity: absolute_entries - absolute_exits, // Estoque registrado (Entradas - Saídas)
      total_pallets: allData.reduce((sum, item) => sum + (item.paletes || 0), 0),
      total_skus: registrosBySku.size,
      absolute_total_skus: absoluteSkusSet.size,
      movement_pieces: registrosBySku.size,
      today_net: absolute_today_net,
      yesterday_net: absolute_yesterday_net,
      total_entries: global_entries,
      total_exits: global_exits,
      period_entries,
      period_exits,
      total_capacity: allData.reduce((sum, item) => sum + (Number(item.capacidade) || 0), 0),
      qtd_molhado: allData.reduce((sum, item) => sum + (Number(item.qtd_molhado) || 0), 0),
      qtd_tombada: allData.reduce((sum, item) => sum + (Number(item.qtd_tombada) || 0), 0),
      frequency_by_product: frequencyMap,
      molh_frequency_by_product: molhFrequencyMap,
      mixed_pallets_consolidated: mixed_pallets_count,
      latest_movements: allFormattedMovements,
      period_movements: allFormattedMovements.filter(m => m.isInPeriod),
      top_moved: allFormattedMovements.slice(0, 10),
      divergences: divergences,
      unregistered_count: unregisteredPositions.size,
      unregistered_positions: Array.from(unregisteredPositions),
      reg_incidence_by_sku: regIncidenceBySku,
      total_drive_qty: total_drive_qty,
      mixed_pallets_count: mixed_pallets_count,
      pendencias: pendencias,
      pendenciasCount: pendencias.length,
      divergenciasLupa: divergenciasLupa
    };
  };

  const fetchAllSupabaseData = async (tableName: string) => {
    let allData: any[] = [];
    let error: any = null;
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error: fetchError, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(from, from + step - 1);

      if (fetchError) {
        error = fetchError;
        hasMore = false;
        break;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += step;
        // If we got fewer than step records, we've reached the end
        if (data.length < step) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return { data: allData, error };
  };

  const fetchData = async () => {
    setLoading(true);
    setIsRefreshing(true);
    setError(null);
    try {
      // 1. Fetch ALL from Supabase tables (pagination bypass)
      const [posicoesRes, mapeamentoRes, historicoRes, baseCodigosRes, ajustesRes, a501Res, g501Res, paletesRes] = await Promise.all([
        fetchAllSupabaseData('posicoes'),
        fetchAllSupabaseData('mapeamento'),
        fetchAllSupabaseData('Registros'),
        fetchAllSupabaseData('base_codigos'),
        fetchAllSupabaseData('Ajuste'),
        fetchAllSupabaseData('A501'),
        fetchAllSupabaseData('G501'),
        supabase.from('Paletes').select('*').order('created_at', { ascending: false }).limit(20)
      ]);

      if (posicoesRes.error) throw posicoesRes.error;
      if (mapeamentoRes.error) throw mapeamentoRes.error;
      // Note: We don't throw if secondary tables fail, to keep the dashboard alive
      if (historicoRes.error) console.warn("Tabela Registros inacessível:", historicoRes.error);
      if (baseCodigosRes.error) console.warn("Tabela base_codigos inacessível:", baseCodigosRes.error);
      if (ajustesRes.error) console.warn("Tabela Ajuste inacessível:", ajustesRes.error);
      if (a501Res.error) console.warn("Tabela A501 inacessível:", a501Res.error);
      if (g501Res.error) console.warn("Tabela G501 inacessível:", g501Res.error);
      if (paletesRes.error) console.warn("Tabela Paletes inacessível:", paletesRes.error);
      else if (paletesRes.data) {
        const recordsByDate: Record<string, { t14?: number, t17?: number, t22?: number }> = {};

        paletesRes.data.forEach((r: any) => {
          let dayStr = "";
          let hour = 0;

          // Confia nos campos "Data" e "Hora" da tabela se existirem (para inserções manuais)
          if (r.Data && r.Hora) {
            dayStr = r.Data;
            hour = parseInt(Math.round(parseFloat(r.Hora.split(":")[0])).toString(), 10);
          } else {
            const date = new Date(r.created_at);
            const localDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
            dayStr = localDate.toISOString().split('T')[0];
            hour = localDate.getUTCHours();
          }

          const qty = Number(r.Quantidade) || Number(r.quantidade) || Number(r.total) || 0;

          if (!recordsByDate[dayStr]) recordsByDate[dayStr] = {};

          if (hour >= 13 && hour <= 15) {
            recordsByDate[dayStr].t14 = qty;
          } else if (hour >= 16 && hour <= 18) {
            recordsByDate[dayStr].t17 = qty;
          } else if (hour >= 21 && hour <= 23) {
            recordsByDate[dayStr].t22 = qty;
          } else {
            // Fallback: aloca no mais próximo
            if (hour < 16) recordsByDate[dayStr].t14 = qty;
            else if (hour < 20) recordsByDate[dayStr].t17 = qty;
            else recordsByDate[dayStr].t22 = qty;
          }
        });

        const nowLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const dHoje = nowLocal.toISOString().split('T')[0];
        const ontemLocal = new Date(nowLocal.getTime() - 24 * 60 * 60 * 1000);
        const dOntem = ontemLocal.toISOString().split('T')[0];

        const recHoje = recordsByDate[dHoje] || {};
        const recOntem = recordsByDate[dOntem] || {};

        const h14 = recHoje.t14 || 0;
        const h17 = recHoje.t17 || 0;
        // Se ainda não houve snapshot 22h hoje, assumimos o de 14h para o deltaH ser zero até fechar
        const h22 = recHoje.t22 !== undefined ? recHoje.t22 : h14;
        const actualH22 = recHoje.t22 !== undefined ? recHoje.t22 : 0;

        const o14 = recOntem.t14 || 0;
        const o22 = recOntem.t22 || 0; // se ontem não teve t22, assume 0 pra conta

        const deltaHoje = h22 - h14;
        const deltaOntem = o22 - o14;

        setPalletTrend(deltaHoje - deltaOntem);
        setPalletHistory({ t14: h14, t17: h17, t22: actualH22, prevT22: o22 });

        const historyArray = Object.keys(recordsByDate)
          .sort((a, b) => b.localeCompare(a))
          .map(date => ({
            date,
            value: recordsByDate[date].t22 || recordsByDate[date].t17 || recordsByDate[date].t14 || 0
          }));
        setDailyHistoryRecords(historyArray);
      }

      const posicoesRaw = posicoesRes.data || [];
      const mapeamentoRaw = mapeamentoRes.data || [];

      let historicoRaw = historicoRes.data || [];
      // Robustness: Fallback to lowercase 'registros' if Title Case 'Registros' is empty or failed
      if (historicoRaw.length === 0) {
        console.log("Tentando buscar na tabela 'registros' (minúsculo)...");
        const altHistorico = await fetchAllSupabaseData('registros');
        if (altHistorico.data && altHistorico.data.length > 0) {
          historicoRaw = altHistorico.data;
          console.log("Movimentos carregados com sucesso da tabela 'registros'.");
        }
      }

      console.log(`Carregados ${historicoRaw.length} movimentos do histórico.`);
      setMovimentosRaw(historicoRaw);

      const baseCodigosRaw = baseCodigosRes.data || [];
      const ajustesRaw = ajustesRes.data || [];
      const a501Raw = a501Res.data || [];
      const g501Raw = g501Res.data || [];

      // Sincronizar ajustes no estado
      const finalAjustes: AjusteManal[] = (ajustesRaw || []).map((a: any) => ({
        id: a.id,
        produto: String(a['Código'] || a['Codigo'] || '').trim().toUpperCase(),
        quantidade: Number(a['Quantidade']) || 0,
        motivo: a['Motivo'] || '',
        usuario: 'Supabase',
        timestamp: new Date(a['Data'] || Date.now())
      }));
      setAjustesConfronto(finalAjustes);

      // 2. Map and Combine logic
      // Create a map of product codes to descriptions
      const skuLookup = new Map();
      baseCodigosRaw.forEach(c => {
        const rawCod = String(c['Código'] || c['Codigo'] || c['PRODUTO'] || "").trim();
        const cod = rawCod.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (cod) {
          skuLookup.set(cod, {
            cod_original: rawCod, // Keep original for fuzzy matching
            descricao: c['Descrição'] || c['Descricao'] || c['NOME'] || '',
            grade: c['Grade'] || '',
            tipo: c['Tipo'] || ''
          });
        }
      });

      // Create a map of positions for easy lookup
      const posLookup = new Map();
      posicoesRaw.forEach(p => {
        const id = String(p['Posições'] || p.posicao || "").trim();
        posLookup.set(id, {
          posicao: id,
          capacidade: Number(p['Capacidade']) || 0,
          status: p['Status'] || 'Aberto',
          observacao_pos: p['Observação'] || '',
          nivel_pos: p['Nível'],
          prof_pos: p['Profundidade'],
          is_unallocated_source: !id || id === 'S/P' || id.toUpperCase() === 'CHÃO' || id.toUpperCase() === 'CHÃO'
        });
      });

      // Join items in mapping with their position info
      const usedPalletIds = new Set();
      const combinedData: any[] = mapeamentoRaw.map(m => {
        const posId = String(m['Posição'] || "").trim();
        const posInfo = posLookup.get(posId) || {
          posicao: posId || 'S/P',
          capacidade: 0,
          status: 'Aberto',
          observacao_pos: '',
          is_unallocated_source: !posId || posId === 'S/P' || posId.toUpperCase() === 'CHÃO' || posId.toUpperCase() === 'CHÃO',
          is_unregistered: !!posId && posId !== 'S/P' && posId.toUpperCase() !== 'CHÃO' && posId.toUpperCase() !== 'CHÃO' && !posLookup.has(posId)
        };

        const rawPalletId = m['Id Palete'];
        const palletId = (rawPalletId && typeof rawPalletId === 'string')
          ? rawPalletId.trim().toUpperCase()
          : (rawPalletId !== null && rawPalletId !== undefined) ? String(rawPalletId).trim().toUpperCase() : null;

        let isFirstOccurrence = false;
        const isInvalidId = !palletId || palletId === "" || palletId === "NAN" || palletId === "-" || palletId === "S/ID" || palletId === "N/A";

        if (!isInvalidId) {
          if (!usedPalletIds.has(palletId)) {
            usedPalletIds.add(palletId);
            isFirstOccurrence = true;
          }
        } else {
          // No valid ID = unique physical pallet by default
          isFirstOccurrence = true;
        }

        // Normalized SKU lookup for consistency
        const mSku = String(m['Código'] || m['Codigo'] || '').trim().toUpperCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        let mDesc = "-";
        let normaPalete = 1;

        if (skuLookup && skuLookup.has(mSku)) {
          const info = skuLookup.get(mSku);
          mDesc = info.descricao;
          if (Number(info['Peças p/ palete']) > 0) normaPalete = Number(info['Peças p/ palete']);
        } else {
          const normMSku = mSku.replace(/[^A-Z0-9-]/g, "");
          const fInfo = Array.from(skuLookup?.values() || []).find((v: any) =>
            String(v.cod_original || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") === normMSku
          );
          mDesc = fInfo ? (fInfo as any).descricao : (m['Observação'] || m['Observacao'] || "-");
          if (fInfo && Number((fInfo as any)['Peças p/ palete']) > 0) {
            normaPalete = Number((fInfo as any)['Peças p/ palete']);
          }
        }

        const fracaoPaletes = (parseBrNum(m['Quantidade']) || 0) / normaPalete;

        return {
          id: m.id,
          ...posInfo,
          id_palete: m['Id Palete'],
          produto: m['Código'],
          descricao: mDesc,
          quantidade_total: parseBrNum(m['Quantidade']) || 0,
          nivel: m['Nível'],
          profundidade: m['Profundidade'],
          qtd_tombada: parseBrNum(m['Parte Tombada']) || 0,
          qtd_molhado: parseBrNum(m['Parte Molhada']) || 0,
          ultima_alteracao: m['Última Alteração'],
          observacao: m['Observação'],
          // Required calculations: 1 if it's the first time we see this ID, 0 otherwise
          paletes: isFirstOccurrence ? 1 : 0,
          fracao_paletes: isInvalidId ? (isFirstOccurrence ? 1 : 0) : fracaoPaletes
        };
      });

      // Also add empty positions to the data so they show up on the map
      const mappedPositions = new Set(combinedData.map(d => d.posicao));
      posLookup.forEach((info, id) => {
        if (!mappedPositions.has(id)) {
          combinedData.push({
            ...info,
            produto: '',
            descricao: '-',
            quantidade_total: 0,
            paletes: 0,
            id_palete: '',
            is_empty: true
          });
        }
      });

      setData(combinedData);
      setBaseCodigosMap(skuLookup);

      // 3. Calculate Stats include movements and system snapshot
      const hojeStats = calculateStatsFromData(combinedData, historicoRaw, "hoje", skuLookup);
      const semanaStats = calculateStatsFromData(combinedData, historicoRaw, "semana", skuLookup);
      const mensalStats = calculateStatsFromData(combinedData, historicoRaw, "mensal", skuLookup);

      setStatsCache({
        hoje: hojeStats,
        semana: semanaStats,
        mensal: mensalStats
      });
      // Start with whichever period is selected right now, defaulting to 'hoje'
      setStats(hojeStats);
      // Set the global (unfiltered) reference stats for the top cards
      setGlobalStats(hojeStats);

    } catch (err: any) {
      setError("Falha na conexão com o Supabase: " + err.message);
      console.error(err);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setIsRefreshing(false);
      }, 500);
    }
  };

  const handleGroupSelected = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedNaoAlocados.size === 0) return;
    
    setIsProcessingGroup(true);
    let idPalletInputTrimmed = palletIdInput.trim();
    
    if (!idPalletInputTrimmed) {
      // Busca a lista mais recente de IDs diretamente do banco para evitar duplicidade
      const { data: latestRows } = await supabase
        .from('mapeamento')
        .select('"Id Palete"')
        .not('"Id Palete"', 'is', null);

      const usedNumbers = new Set<number>();
      latestRows?.forEach(row => {
        const id = String(row['Id Palete'] || "").trim();
        if (id.toUpperCase().startsWith("P.")) {
          const num = parseInt(id.substring(2).trim(), 10);
          if (!isNaN(num)) usedNumbers.add(num);
        }
      });

      // Encontra o primeiro número disponível (preenchendo lacunas)
      let candidate = 1;
      while (usedNumbers.has(candidate)) {
        candidate++;
      }
      
      idPalletInputTrimmed = `P.${String(candidate).padStart(3, '0')}`;
      console.log(`[Sequencial] Próximo ID gerado via DB: ${idPalletInputTrimmed}`, { emUso: Array.from(usedNumbers) });
    }

    try {
      const idsArray = Array.from(selectedNaoAlocados);
      
      // Update each item in the database
      for (const id of idsArray) {
        const { error: updErr } = await supabase
          .from('mapeamento')
          .update({ "Id Palete": idPalletInputTrimmed })
          .eq('id', id);
          
        if (updErr) {
          console.error("Group Update Error:", updErr);
          throw new Error("Falha ao agrupar paletes no banco de dados.");
        }
      }
      
      setShowGroupModal(false);
      setPalletIdInput("");
      setSelectedNaoAlocados(new Set());
      await fetchData(); // Refresh data to show in Mix!
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao agrupar");
    } finally {
      setIsProcessingGroup(false);
    }
  };

  const handleUngroupSelected = async (targetIds?: string[]) => {
    const idsArray = targetIds || Array.from(selectedNaoAlocados);
    if (idsArray.length === 0) return;
    
    setIsProcessingGroup(true);
    try {
      for (const id of idsArray) {
        // Converte id para número se for numérico no banco, para evitar erro de tipo
        const targetId = isNaN(Number(id)) ? id : Number(id);

        const { error: updErr } = await supabase
          .from('mapeamento')
          .update({ 
            "Id Palete": "", 
            "Posição": "Chão" 
          })
          .eq('id', targetId);
          
        if (updErr) {
          const errorMsg = `Erro ${updErr.code}: ${updErr.message}${updErr.hint ? ' (' + updErr.hint + ')' : ''}`;
          console.error("Erro detalhado no Desagrupar:", errorMsg);
          throw new Error(`Item ${id} - ${errorMsg}`);
        }
      }
      
      if (!targetIds) {
        setSelectedNaoAlocados(new Set());
      }
      await fetchData(); // Refresh data!
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao desagrupar");
    } finally {
      setIsProcessingGroup(false);
    }
  };

  const fetchStatistics = async (manual = false) => {
    // Now just a wrapper for fetchData as stats are calculated on the fly
    if (manual) await fetchData();
  };



  useEffect(() => {
    // Carrega tudo na primeira vez
    fetchData()
  }, []) // Apenas no mount


  // Sync current stats view from cache when period changes (Instant switch)
  useEffect(() => {
    if (statsCache[movementPeriod]) {
      setStats(statsCache[movementPeriod])
    }
  }, [movementPeriod, statsCache])

  useEffect(() => {
    setConfrontoCurrentPage(1);
  }, [confrontoSearch, confrontoFilter, confrontoType, confrontoSortDir]);

  const fetchConfrontos = async () => {
    setLoadingConfrontos(true)
    setErrorConfrontos(null)
    try {
      const { data: a501Raw, error: a501Err } = await supabase.from('A501').select('*');
      const { data: g501Raw, error: g501Err } = await supabase.from('G501').select('*');
      const { data: ajustesRaw, error: ajustesErr } = await supabase.from('Ajuste').select('*');

      if (a501Err) console.warn("Erro ao buscar A501 de Supabase:", a501Err);
      if (g501Err) console.warn("Erro ao buscar G501 de Supabase:", g501Err);
      if (ajustesErr) console.warn("Erro ao buscar Ajuste de Supabase:", ajustesErr);

      // Sincronizar ajustes no estado (sempre pegar os mais recentes antes do cálculo)
      if (!ajustesErr && ajustesRaw) {
        const finalAjustes: AjusteManal[] = (ajustesRaw || []).map((a: any) => ({
          id: a.id,
          produto: String(a['Código'] || a['Codigo'] || '').trim().toUpperCase(),
          quantidade: Number(a['Quantidade']) || 0,
          motivo: a['Motivo'] || '',
          usuario: 'Supabase',
          timestamp: new Date(a['Data'] || Date.now())
        }));
        setAjustesConfronto(finalAjustes);
      }

      // 2. Helper to group data by SKU (normalized) and capture description
      const groupData = (list: any[], skuKey: string, qtyKey: string, descKey?: string) => {
        const grouped = new Map();
        list.forEach(item => {
          // Robust SKU mapping
          const sku = String(item[skuKey] || item['produto'] || item['sku'] || item['Código'] || item['PRODUTO'] || "").trim().toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          if (sku) {
            const current = grouped.get(sku) || { qty: 0, desc: "-" };
            // Robust Quantity mapping
            current.qty += (Number(item[qtyKey] || item['quantidade'] || item['Quantidade'] || item['Qtd'] || 0));

            // Robust Description mapping
            const dKey = descKey || 'descrição' || 'Descrição' || 'Descricao' || 'NOME';
            if (item[dKey] && item[dKey] !== "-" && item[dKey] !== "nan") {
              current.desc = item[dKey];
            } else if (item['Descrição'] && item['Descrição'] !== "-") {
              current.desc = item['Descrição'];
            } else if (item['Descricao'] && item['Descricao'] !== "-") {
              current.desc = item['Descricao'];
            }

            grouped.set(sku, current);
          }
        });
        return grouped;
      };

      // Group Supabase tables (Use 'Descrição' or 'Descricao' if available)
      const a501Grouped = groupData(a501Raw || [], 'Produto', 'Quantidade', 'Descrição');
      const g501Grouped = groupData(g501Raw || [], 'Produto', 'Quantidade', 'Descrição');

      // Group Inventory data (Physical Source: Movements Balance from Registros)
      const fisGrouped = new Map();
      const fisDescMap = new Map(); // Store descriptions for fallback

      // Use persisted movimentosRaw instead of undefined historicoRaw
      const movimentosParaConfronto = movimentosRaw.length > 0 ? movimentosRaw : [];

      movimentosParaConfronto.forEach(m => {
        const sku = String(m['Produto'] || m['produto'] || m['Código'] || m['codigo'] || m['Codigo'] || "").trim().toUpperCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (sku && sku !== "-" && sku !== "NAN") {
          const ent = parseBrNum(m['Entrada'] || m['entrada']);
          const sai = parseBrNum(m['Saída'] || m['saida'] || m['Saida'] || m['saída']);
          fisGrouped.set(sku, (fisGrouped.get(sku) || 0) + (ent - sai));
        }
      });

      // Also get descriptions from current mapping if available
      data.forEach(item => {
        const sku = String(item.produto || "").trim().toUpperCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (sku && item.descricao && item.descricao !== "-") {
          fisDescMap.set(sku, item.descricao);
        }
      });


      // 3. Process Fisico vs A501
      const processResults = (source1: Map<string, any | number>, source2: Map<string, any | number>) => {
        // Normalize sources to {qty, desc} format if they aren't already
        const normSource1 = new Map();
        source1.forEach((v, k) => normSource1.set(k, typeof v === 'number' ? { qty: v, desc: fisDescMap.get(k) || "-" } : v));
        const normSource2 = new Map();
        source2.forEach((v, k) => normSource2.set(k, typeof v === 'number' ? { qty: v, desc: "-" } : v));

        const allSkus = new Set([...normSource1.keys(), ...normSource2.keys()]);
        const results = Array.from(allSkus).map(sku => {
          const s1 = normSource1.get(sku) || { qty: 0, desc: "-" };
          const s2 = normSource2.get(sku) || { qty: 0, desc: "-" };

          // Pick the best description available
          let desc = s1.desc !== "-" ? s1.desc : (s2.desc !== "-" ? s2.desc : (fisDescMap.get(sku) || "-"));

          return {
            produto: sku,
            descricao: desc,
            qtd_fisica: s1.qty,
            qtd_sistema: s2.qty,
            diferenca: s1.qty - s2.qty
          };
        }).sort((a, b) => {
          // Sort by deviation first (absolute difference)
          const diffA = Math.abs(a.diferenca);
          const diffB = Math.abs(b.diferenca);
          if (diffA !== 0 && diffB === 0) return -1;
          if (diffA === 0 && diffB !== 0) return 1;
          return diffB - diffA || a.produto.localeCompare(b.produto);
        });

        return {
          total_produtos: results.length,
          itens_com_divergencia: results.filter(r => r.diferenca !== 0).length,
          dados: results
        };
      };

      const results = {
        fisico_x_a501: processResults(fisGrouped, a501Grouped),
        a501_x_g501: processResults(a501Grouped, g501Grouped)
      };

      setConfrontosCache(results)
      setConfrontosData(results[confrontoType])
    } catch (err) {
      console.error(err)
      setErrorConfrontos("Falha ao processar confrontos via Supabase")
    } finally {
      setLoadingConfrontos(false)
    }
  }

  // Sync current confrontos view from cache when type changes (Instant switch)
  useEffect(() => {
    if (confrontosCache[confrontoType]) {
      setConfrontosData(confrontosCache[confrontoType])
    }
    // Se o filtro 'Ajustados' estiver ativo e o modo mudar para A501 vs G501, resetar para 'all'
    if (confrontoType === "a501_x_g501" && confrontoFilter === "adjusted") {
      setConfrontoFilter("all")
    }
  }, [confrontoType, confrontosCache])

  useEffect(() => {
    if (topTab === 'confrontos' && Object.keys(confrontosCache).length === 0) {
      fetchConfrontos()
    }
  }, [topTab, confrontosCache])

  // -- SUPABASE SYNC --
  useEffect(() => {
    const fetchAjustesSupabase = async () => {
      try {
        const { data: ajustes, error } = await supabase
          .from('Ajuste')
          .select('*')

        if (error) throw error

        if (ajustes) {
          const formatted = ajustes.map((a: any) => ({
            id: a.id,
            produto: String(a['Código'] || a['Codigo'] || '').trim().toUpperCase(),
            quantidade: Number(a['Quantidade']) || 0,
            motivo: a['Motivo'] || '',
            usuario: "Supabase",
            timestamp: new Date(a['Data'] || Date.now())
          }))
          setAjustesConfronto(formatted)
        }
      } catch (err: any) {
        console.warn("Aviso (Não é um erro fatal): Tabela Ajuste ausente ou falhou:", err?.message || err)
      }
    }

    if (topTab === 'confrontos') {
      fetchAjustesSupabase()
    }
  }, [topTab])

  // street processing logic (Integrated)
  const streetData = useMemo(() => {
    // Dynamic streets object based on prefixes found in data
    const streets: Record<string, { even: any[], odd: any[] }> = {}

    const posMap = new Map()
    data.forEach(item => {
      // Otimização: Se houver busca, ignorar itens que não batem com o SKU ou com a Posição
      const matchesSearch = !search ||
        (item.produto || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.posicao || "").toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return

      const posId = item.posicao || "S/P"
      if (!posMap.has(posId)) {
        posMap.set(posId, {
          id: posId,
          paletes: 0,
          capacidade: item.capacidade || 0,
          is_blocked: item.is_blocked || item.status === "Fechado" || item.status === "Bloqueado",
          status: item.status,
          observacao_pos: item.observacao_pos,
          unregistered_error: item.unregistered_error || false,
          products: []
        })
      }
      const entry = posMap.get(posId)
      entry.paletes += (item.paletes || 0)
      if (item.unregistered_error) entry.unregistered_error = true
      if (item.produto) {
        const total = item.quantidade_total || 0
        const damaged = item.qtd_molhado || 0
        entry.products.push({
          id: item.id,
          sku: item.produto,
          quantidade: total - damaged,
          quantidade_total: total,
          paletes: item.paletes,
          nivel: item.nivel || "N/A",
          profundidade: item.profundidade || item.Profundidade || "-",
          qtd_por_palete: item.qtd_por_palete || item["Quantidade/palete"] || 0,
          qtd_tombada: item.qtd_tombada || 0,
          qtd_molhado: item.qtd_molhado || 0,
          pos_interna: item.posicao_interna || item.posicao?.split('-')?.pop() || "N/A"
        })
      }
    })

    posMap.forEach((p, id) => {
      // Regex adjusted for the format: G30000[STREET][NUMBER]
      // Matches any 2-character street prefix like 1G, 1F, 2G, 3G, 4G...
      const match = id.match(/([0-9][A-Z])(\d+)/i)
      if (match) {
        const prefix = match[1].toUpperCase()
        const fullNumStr = match[2]

        const bayNum = parseInt(fullNumStr.substring(0, 3))
        const isEven = bayNum % 2 === 0
        const side = isEven ? "even" : "odd"

        if (!streets[prefix]) {
          streets[prefix] = { even: [], odd: [] }
        }

        streets[prefix][side].push(p)
      }
    })

    const sortPos = (arr: any[]) => arr.sort((a, b) => {
      const matchA = a.id.match(/([0-9][A-Z])(\d+)/i)
      const matchB = b.id.match(/([0-9][A-Z])(\d+)/i)
      const numA = matchA ? parseInt(matchA[2]) : 0
      const numB = matchB ? parseInt(matchB[2]) : 0
      return numA - numB
    })

    Object.values(streets).forEach(s => {
      if ('even' in s) sortPos(s.even)
      if ('odd' in s) sortPos(s.odd)
    })

    return streets
  }, [data, search])

  // Mixed Pallets Detection Logic
  const mixedPalletsData = useMemo(() => {
    const palletGroups = new Map<string, any[]>()

    data.forEach(item => {
      const id = item.id_palete?.toString()?.trim()
      if (!id || id === "0" || id === "" || id.toLowerCase() === "nan") return

      if (!palletGroups.has(id)) {
        palletGroups.set(id, [])
      }
      palletGroups.get(id)?.push(item)
    })

    const mixed = []
    for (const [id, items] of palletGroups.entries()) {
      const skus = new Set(items.map(i => i.produto))
      const positions = new Set(items.map(i => i.posicao || "S/P"))
      const hasSP = positions.has("S/P")
      const hasAllocated = Array.from(positions).some(p => p !== "S/P")

      const isMixedSku = skus.size > 1
      const isMixedStatus = hasSP && hasAllocated

      if (isMixedSku || isMixedStatus) {
        mixed.push({
          id,
          totalQty: items.reduce((sum, i) => sum + (i.quantidade_total || 0), 0),
          skuCount: skus.size,
          skus: Array.from(skus),
          isMixedSku,
          isMixedStatus,
          items
        })
      }
    }

    return mixed.sort((a, b) => {
      switch (mixedSort) {
        case "name_asc": return a.id.localeCompare(b.id, undefined, { numeric: true })
        case "name_desc": return b.id.localeCompare(a.id, undefined, { numeric: true })
        case "sku_asc": return a.skuCount - b.skuCount
        case "sku_desc": return b.skuCount - a.skuCount
        default: return b.totalQty - a.totalQty
      }
    })
  }, [data, mixedSort])

  // View Aggregation & Filtering Logic
  const processedData = useMemo(() => {
    let baseData = []

    if (activeView === "posicoes") {
      const posMap = new Map()
      data.forEach(item => {
        const pos = item.posicao || "S/P"
        if (!posMap.has(pos)) {
          posMap.set(pos, {
            posicao: pos,
            paletes: 0,
            quantidade_total: 0,
            skus: new Set(),
            nivel: item.nivel,
            capacidade: item.capacidade || 0,
            is_blocked: item.is_blocked || item.status === "Fechado" || item.status === "Bloqueado"
          })
        }
        const entry = posMap.get(pos)
        entry.paletes += (item.paletes || 0)
        entry.quantidade_total += (item.quantidade_total || 0)
        entry.dmg_molhado = (entry.dmg_molhado || 0) + (item.qtd_molhado || 0)
        if (item.produto) entry.skus.add(item.produto)
      })

      baseData = Array.from(posMap.values())
        .filter(item => !item.is_blocked) // Excluir bloqueados da tabela de posições
        .map(item => {
          const roundedCap = Math.round(item.capacidade)
          const roundedPal = Math.round(item.paletes)
          return {
            ...item,
            sku_count: item.skus.size,
            quantidade: item.quantidade_total - (item.dmg_molhado || 0),
            ocupacao: roundedCap > 0 ? (item.paletes / item.capacidade * 100) : 0,
            drive_status: item.skus.size > 1 ? "MISTURADO" : "MONO",
            is_complete: roundedCap > 0 && roundedPal > roundedCap ? "OVERFLOW" : roundedCap > 0 && roundedPal >= roundedCap ? "COMPLETO" : "DISPONÍVEL",
            is_overflow: roundedCap > 0 && roundedPal > roundedCap
          }
        })
    } else if (activeView === "produtos") {
      const productMap = new Map()
      data.forEach(item => {
        const prodRaw = getVal(item, ['produto', 'sku', 'product'])
        if (!prodRaw || String(prodRaw).trim() === "") return
        const prod = String(prodRaw)
        
        if (!productMap.has(prod)) {
          productMap.set(prod, {
            produto: prod,
            paletes: 0,
            quantidade_total: 0,
            posicoes: new Set(),
            descricao: getVal(item, ['descricao', 'description', 'info']) || "-",
            dmg_molhado: 0,
            dmg_tombada: 0
          })
        }
        const entry = productMap.get(prod)
        entry.paletes += Number(getVal(item, ['paletes', 'pallets', 'total_paletes']) || 0)
        entry.quantidade_total += Number(getVal(item, ['quantidade', 'quantidade_total', 'total']) || 0)
        entry.dmg_molhado += Number(getVal(item, ['qtd_molhado', 'molhados', 'molhado']) || 0)
        entry.dmg_tombada += (item.qtd_tombada || 0)
        if (item.posicao) entry.posicoes.add(item.posicao)
      })

      baseData = Array.from(productMap.values()).map(item => ({
        ...item,
        posicao_count: item.posicoes.size,
        quantidade: item.quantidade_total
      }))

      // Calc global prominence (Top 3 by Quantity)
      const sortedByQty = [...baseData].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0))
      baseData = baseData.map(item => ({
        ...item,
        qtyRank: sortedByQty.findIndex(s => s.produto === item.produto) + 1
      }))
    } else if (activeView === "molhados") {
      const productMap = new Map()
      const skusWithWet = new Set()
      data.forEach(item => {
        if (item.qtd_molhado && item.qtd_molhado > 0 && item.produto && item.produto.trim() !== "") {
          skusWithWet.add(item.produto)
        }
      })

      data.forEach(item => {
        if (!item.produto || item.produto.trim() === "") return
        const prod = item.produto
        if (!skusWithWet.has(prod)) return

        if (!productMap.has(prod)) {
          productMap.set(prod, {
            produto: prod,
            paletes: 0,
            quantidade_total: 0,
            dmg_molhado: 0,
            posicoes_com_molhado: new Set(),
            descricao: item.descricao || "-"
          })
        }
        const entry = productMap.get(prod)
        entry.paletes += (item.paletes || 0)
        entry.quantidade_total += (item.quantidade_total || 0)
        entry.dmg_molhado += (item.qtd_molhado || 0)
        if (item.qtd_molhado && item.qtd_molhado > 0 && item.posicao) {
          entry.posicoes_com_molhado.add(item.posicao)
        }
      })

      baseData = Array.from(productMap.values()).map(item => ({
        ...item,
        posicao_count: item.posicoes_com_molhado.size,
        quantidade: item.dmg_molhado
      }))

      // Calc global prominence (Top 3 by Quantity)
      const sortedByQty = [...baseData].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0))
      baseData = baseData.map(item => ({
        ...item,
        qtyRank: sortedByQty.findIndex(s => s.produto === item.produto) + 1
      }))
    } else if (activeView === "nao_alocados") {
      baseData = data.filter(item => {
        const pos = String(item.posicao || "").toUpperCase()
        return !pos || pos === "S/P" || pos === "NÃO INFORMADO" || pos === "-" || pos === "CHÃO" || pos === "CHÃO" || item.is_unallocated_source
      }).map(item => ({
        ...item,
        posicao: item.posicao || "S/P"
      }))
    } else {
      baseData = [...data]
    }

    // Global Sort Mode (The Buttons)
    if (sortMode === "qty_desc") {
      baseData.sort((a, b) => (b.quantidade || b.quantidade_total || 0) - (a.quantidade || a.quantidade_total || 0))
    } else if (sortMode === "qty_asc") {
      baseData.sort((a, b) => (a.quantidade || a.quantidade_total || 0) - (b.quantidade || b.quantidade_total || 0))
    } else if (sortMode === "alpha_asc") {
      baseData.sort((a, b) => {
        const key = (activeView === "produtos" || activeView === "molhados") ? "produto" : "posicao"
        return String(a[key]).localeCompare(String(b[key]))
      })
    }

    // Generic sorting for Table (Overrides global sort if header is clicked)
    if (tableSort.key && tableSort.key !== "none") {
      baseData.sort((a, b) => {
        let valA = a[tableSort.key]
        let valB = b[tableSort.key]

        if (valA === undefined || valA === null) valA = ""
        if (valB === undefined || valB === null) valB = ""

        if (typeof valA === "string") valA = valA.toLowerCase()
        if (typeof valB === "string") valB = valB.toLowerCase()

        if (valA < valB) return tableSort.direction === "asc" ? -1 : 1
        if (valA > valB) return tableSort.direction === "asc" ? 1 : -1
        return 0
      })
    }

    // FINAL STEP: Assign rank based on final visual order for ALL items
    return baseData.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }))
  }, [data, activeView, sortMode, tableSort])

  const handleSort = (key: string) => {
    setSortMode("none")
    setTableSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }))
  }

  const filteredData = useMemo(() => {
    return processedData.filter(item =>
      Object.values(item).some(val =>
        String(val).toLowerCase().includes(search.toLowerCase())
      )
    )
  }, [processedData, search])

  // Pagination Logic
  const totalPages = rowsPerPage === 'ALL' ? 1 : Math.ceil(filteredData.length / rowsPerPage)
  const paginatedData = useMemo(() => {
    if (rowsPerPage === 'ALL') return filteredData;
    const start = (currentPage - 1) * rowsPerPage
    return filteredData.slice(start, start + rowsPerPage)
  }, [filteredData, currentPage, rowsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeView, search, sortMode])

  // Advanced Stats Calculation
  const advancedStats = useMemo(() => {
    const posMap = new Map()
    const capBreakdown = new Map()
    const globalPosMap = new Map()
    const posOccupancy = new Map()

    data.forEach(item => {
      let activePos = item.posicao

      // Ultra-robust fallback: if posicao is N/A, check if any key or value looks like G300
      if (!activePos || activePos === 'N/A') {
        const potentialKey = Object.keys(item).find(k => k.startsWith('G300'))
        if (potentialKey) {
          activePos = item[potentialKey]
        } else {
          // Check values
          const potentialVal = Object.values(item).find(v => String(v).startsWith('G300'))
          if (potentialVal) activePos = String(potentialVal)
        }
      }

      const posUpper = (activePos || "").toUpperCase()
      const isRealDrive = posUpper && posUpper !== "S/P" && posUpper !== "NÃO INFORMADO" && posUpper !== "-" && posUpper !== "CHÃO" && posUpper !== "CHÃO" && !item.is_unallocated_source
      const isBlocked = item.is_blocked || item.status === "Fechado" || item.status === "Bloqueado"

      if (isRealDrive && !isBlocked) {
        if (!globalPosMap.has(activePos)) {
          globalPosMap.set(activePos, new Set())
          posOccupancy.set(activePos, 0)
        }
        const prod = getVal(item, ['produto', 'sku', 'product'])
        if (prod) globalPosMap.get(activePos).add(prod)

        const cap = Number(getVal(item, ['capacidade', 'vagas', 'positions']) || 0)
        posMap.set(activePos, cap)
        
        const paletesFound = Number(getVal(item, ['paletes', 'pallets', 'total_paletes']) || 0)
        posOccupancy.set(activePos, (posOccupancy.get(activePos) || 0) + paletesFound)
      }
    })

    let mixedCount = 0
    let monoCount = 0
    let vazioCount = 0
    let lotadoCount = 0
    let totalMixed = 0
    let totalMono = 0
    let alocadosPallets = 0
    let naoAlocadosPallets = 0
    let molhadosPallets = 0
    let tombadosPallets = 0

    const checkStatus = (item: any) => {
      const prod = String(item.produto || "").toLowerCase()
      if (prod.includes("molhado")) molhadosPallets += (item.paletes || 0)
      if (prod.includes("tombado")) tombadosPallets += (item.paletes || 0)
    }

    const overflowPositions: string[] = []
    globalPosMap.forEach((skus, pos) => {
      const cap = posMap.get(pos) || 0
      const occ = posOccupancy.get(pos) || 0

      if (skus.size > 1) totalMixed++
      else if (skus.size === 1) totalMono++

      const roundedCap = Math.round(cap)
      const roundedOcc = Math.round(occ)

      if (roundedCap > 0 && roundedOcc >= roundedCap) {
        lotadoCount++
        if (roundedOcc > roundedCap) {
          overflowPositions.push(pos)
        }
      } else if (roundedOcc === 0) {
        vazioCount++
      } else {
        if (skus.size > 1) mixedCount++
        else monoCount++
      }
    })

    data.forEach(item => {
      const posUpper = String(item.posicao || "").toUpperCase()
      const isAllocated = posUpper && posUpper !== "S/P" && posUpper !== "NÃO INFORMADO" && posUpper !== "-" && posUpper !== "CHÃO" && posUpper !== "CHÃO" && !item.is_unallocated_source
      const isBlocked = item.is_blocked || item.status === "Fechado" || item.status === "Bloqueado"

      if (isAllocated && !isBlocked) alocadosPallets += (item.paletes || 0)
      else if (!isAllocated) naoAlocadosPallets += (item.paletes || 0)

      if (!isBlocked) checkStatus(item)
    })

    posMap.forEach((cap) => {
      capBreakdown.set(cap, (capBreakdown.get(cap) || 0) + 1)
    })

    const totalCapacity = Array.from(posMap.values()).reduce((sum, cap) => sum + cap, 0)
    const totalPositions = posMap.size

    // FIX: occupied should ONLY count allocated pallets to match backend stats
    const occupied = Math.round(data.filter(i => {
      const p = String(i.posicao || "").toUpperCase();
      return p && p !== "S/P" && p !== "NÃO INFORMADO" && p !== "-" && p !== "CHÃO" && p !== "CHÃO" && !i.is_unallocated_source;
    }).reduce((s, i) => s + (i.paletes || 0), 0));

    const free = Math.round(Math.max(0, totalCapacity - occupied))
    const occupiedPercent = totalCapacity > 0 ? (occupied / totalCapacity) * 100 : 0

    const sortedBreakdown = Array.from(capBreakdown.entries())
      .map(([cap, count]) => ({ capacity: cap, count }))
      .sort((a, b) => a.capacity - b.capacity)

    return {
      totalCapacity,
      totalPositions,
      occupied,
      free,
      occupiedPercent: totalCapacity > 0 ? (occupied / totalCapacity) * 100 : 0,
      breakdown: sortedBreakdown,
      mixedCount,
      monoCount,
      vazioCount,
      lotadoCount,
      totalMixed,
      totalMono,
      completoCount: lotadoCount,
      disponivelCount: totalPositions - lotadoCount,
      alocadosPallets,
      naoAlocadosPallets,
      molhadosPallets,
      tombadosPallets,
      mixPercent: (totalMono + totalMixed) > 0 ? (totalMixed / (totalMono + totalMixed) * 100) : 0,
      overflowCount: overflowPositions.length,
      overflowPositions,
      top10Skus: (() => {
        const skuMap = new Map()
        data.forEach(item => {
          const skuRaw = getVal(item, ['produto', 'sku', 'product'])
          const sku = String(skuRaw || "S/I").trim()
          
          if (!skuMap.has(sku)) {
            skuMap.set(sku, {
              sku,
              descricao: getVal(item, ['descricao', 'description', 'info']) || "Item Sem Descrição",
              paletes: 0,
              quantidade: 0,
              molhados: 0,
              registrosGeral: 0,
              registrosMolhado: 0,
              posicoes: new Set()
            })
          }
          const entry = skuMap.get(sku)
          
          const paletesVal = Number(getVal(item, ['paletes', 'pallets', 'total_paletes']) || 0)
          entry.paletes += paletesVal
          
          const qtyVal = Number(getVal(item, ['quantidade', 'quantidade_total', 'total']) || 0)
          entry.quantidade += qtyVal
          
          const prodLower = String(skuRaw || "").toLowerCase()
          const wetFieldVal = Number(getVal(item, ['qtd_molhado', 'molhados', 'molhado']) || 0)
          const wetQty = wetFieldVal || (prodLower.includes("molhado") ? qtyVal : 0)
          entry.molhados += wetQty

          const p = String(item.posicao || "").toUpperCase()
          if (p && p !== "S/P" && p !== "NÃO INFORMADO" && p !== "-") {
            entry.posicoes.add(p)
          }
        })

        const freqMap = stats?.frequency_by_product || {}
        const molhFreqMap = stats?.molh_frequency_by_product || {}

        return Array.from(skuMap.values())
          .map(item => {
            // Robust detection for the 'top' view
            const keys = Object.keys(item);
            const qtyKey = keys.find(k => ['quantidade', 'quantidade_total', 'total'].includes(k.toLowerCase())) || 'quantidade';
            const prodKey = keys.find(k => ['produto', 'sku', 'product'].includes(k.toLowerCase())) || 'sku';
            
            const regIncidenceMap = stats?.reg_incidence_by_sku || {}
            
            return {
              ...item,
              sku: String(item[prodKey] || item.sku || "S/I"),
              quantidade: Number(item[qtyKey] || item.quantidade || 0),
              posicoesCount: (item.posicoes as Set<string>).size,
              incidencia: topSkusFilter === "molhado"
                ? (molhFreqMap[item.sku] || freqMap[item.sku] || 0)
                : topSkusFilter === "incidencia"
                ? (regIncidenceMap[item.sku] || 0)
                : (freqMap[item.sku] || 0)
            };
          })
          .filter(item => {
            if (topSkusFilter === "geral" || topSkusFilter === "incidencia") return true
            return item.molhados > 0 || String(item.sku).toLowerCase().includes("molhado")
          })
          .sort((a, b) => {
            if (topSkusSort === "incidencia" || topSkusFilter === "incidencia") {
              return b.incidencia - a.incidencia || b.molhados - a.molhados || b.quantidade - a.quantidade
            }
            const valA = topSkusFilter === "molhado" ? a.molhados : a.quantidade
            const valB = topSkusFilter === "molhado" ? b.molhados : b.quantidade
            return valB - valA || b.quantidade - a.quantidade
          })
          .slice(0, 3)
      })()
    }
  }, [data, stats, topSkusFilter, topSkusSort])

  const topSkus = advancedStats.top10Skus; // Fix ReferenceError

  const getColumns = () => {
    if (activeView === "posicoes") {
      return [
        {
          header: "Posição",
          accessor: "posicao",
          render: (val: string) => (
            <span className="text-slate-500 dark:text-slate-400 tracking-tight transition-colors">
              {val}
            </span>
          )
        },
        { header: "Capacidade", accessor: "capacidade", render: (val: number) => <span className="text-slate-500 dark:text-slate-400 tracking-tight">{fmtNum(val)}</span> },
        { header: "Paletes", accessor: "paletes", render: (val: number) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)}</span> },
        {
          header: "Diversidade",
          accessor: "sku_count",
          render: (val: number) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)}</span>
        },
        {
          header: "Mix",
          accessor: "drive_status",
          render: (val: string) => (
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-1 text-[10px] uppercase transition-colors shrink-0",
              val === "MISTURADO"
                ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20"
                : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20"
            )}>
              {val}
            </span>
          )
        },
        {
          header: "Ocupação",
          accessor: "ocupacao",
          render: (val: number) => (
            <div className="flex w-32 items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-50 dark:bg-slate-800 overflow-hidden border border-slate-100/50 dark:border-slate-700/50 transition-colors">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(val, 100)}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    val > 100 ? "bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]" : val >= 100 ? "bg-red-500" : val >= 75 ? "bg-orange-500" : "bg-blue-500"
                  )}
                />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 transition-colors uppercase">{Math.round(val)}%</span>
            </div>
          )
        },
        {
          header: "Lotação",
          accessor: "is_complete",
          render: (val: string) => (
            <span className={cn(
              "inline-flex items-center rounded-full px-3 py-1.5 text-[10px] uppercase shadow-sm transition-all shrink-0",
              val === "OVERFLOW"
                ? "bg-red-600 text-white shadow-lg shadow-red-500/30 animate-pulse"
                : val === "COMPLETO"
                  ? "bg-blue-600 dark:bg-blue-700 text-white shadow-blue-100/50 dark:shadow-blue-900/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50"
            )}>
              {val}
            </span>
          )
        },
      ]
    }

    if (activeView === "produtos") {
      return [
        {
          header: "Produto",
          accessor: "produto",
          render: (val: string, item: any) => {
            const isTopQty = item.qtyRank <= 3
            const isVisualTop = item.rank <= 3
            const isSortedByQty = sortMode === "qty_desc"
            const showHighlight = isVisualTop && isTopQty && isSortedByQty

            return (
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
                  showHighlight ? (
                    item.rank === 1 ? "bg-orange-500 text-white shadow-lg shadow-orange-100 dark:shadow-orange-900/20" :
                      item.rank === 2 ? "bg-orange-400 text-white shadow-md shadow-orange-50/50 dark:shadow-orange-900/10" :
                        "bg-orange-300 text-white shadow-sm"
                  ) : (
                    "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700 transition-colors"
                  )
                )}>
                  {item.rank}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    {showHighlight && (
                      <Flame size={14} className={cn(
                        "text-orange-500 fill-orange-500",
                        item.qtyRank === 1 && "animate-pulse"
                      )} />
                    )}
                    <span className={cn(
                      showHighlight ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400"
                    )}>
                      {val}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px] leading-tight">
                      {item.descricao && item.descricao !== "-" ? item.descricao : "Não Identificado"}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase transition-colors">
                      {item.posicao_count} Posições
                    </span>
                  </div>
                </div>
              </div>
            )
          }
        },
        {
          header: "Grade",
          accessor: "produto",
          render: (val: string) => {
            const gradeVal = baseCodigosMap.get(val)?.grade
            return (
              <span className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">
                {gradeVal ? fmtNum(Number(gradeVal)) : "-"}
              </span>
            )
          }
        },
        { header: "Paletes", accessor: "paletes", render: (val: number) => <span className="text-slate-500 dark:text-slate-400 transition-colors uppercaseTracking-tight">{fmtNum(val)}</span> },
        {
          header: "Quantidade",
          accessor: "quantidade",
          render: (val: number, item: any) => {
            const isTopQty = item.qtyRank <= 3
            const isVisualTop = item.rank <= 3
            const showHighlight = isVisualTop && isTopQty && sortMode === "qty_desc"

            if (showHighlight) {
              return (
                <span className={cn(
                  "px-3 py-1 rounded-xl transition-all border shrink-0",
                  item.rank === 1 ? "bg-orange-600 dark:bg-orange-700 text-white border-orange-500 dark:border-orange-600 shadow-md shadow-orange-100 dark:shadow-orange-900/20" :
                    item.rank === 2 ? "bg-orange-500 dark:bg-orange-600 text-white border-orange-400 dark:border-orange-500 shadow-sm" :
                      "bg-orange-400 dark:bg-orange-500 text-white border-orange-300 dark:border-orange-400"
                )}>
                  {fmtNum(val)}
                </span>
              )
            }

            return (
              <span className={cn(
                "px-2 transition-all text-slate-500 dark:text-slate-400",
                isTopQty ? "font-medium" : "font-medium"
              )}>
                {fmtNum(val)}
              </span>
            )
          }
        },
        { header: "Nº de Posições", accessor: "posicao_count", render: (val: number) => <span className="text-slate-500 dark:text-slate-400 transition-colors">{fmtNum(val)}</span> },
      ]
    }

    if (activeView === "molhados") {
      return [
        {
          header: "Produto",
          accessor: "produto",
          render: (val: string, item: any) => {
            const isTopQty = item.qtyRank <= 3
            const isVisualTop = item.rank <= 3
            const isSortedByQty = sortMode === "qty_desc"
            const showHighlight = isVisualTop && isTopQty && isSortedByQty

            return (
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
                  showHighlight ? (
                    item.rank === 1 ? "bg-blue-500 text-white shadow-lg shadow-blue-100 dark:shadow-blue-900/20" :
                      item.rank === 2 ? "bg-blue-400 text-white shadow-md shadow-blue-50/50 dark:shadow-blue-900/10" :
                        "bg-blue-300 text-white shadow-sm"
                  ) : (
                    "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700 transition-colors"
                  )
                )}>
                  {item.rank}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    {showHighlight && (
                      <Droplet size={14} className={cn(
                        "text-blue-500 fill-blue-500",
                        item.qtyRank === 1 && "animate-pulse"
                      )} />
                    )}
                    <span className={cn(
                      "text-sm transition-colors uppercase tracking-tight",
                      showHighlight ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
                    )}>
                      {val}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px] leading-tight">
                      {item.descricao && item.descricao !== "-" ? item.descricao : "Não Identificado"}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase transition-colors">
                      {item.posicao_count} Posições com Molhado
                    </span>
                  </div>
                </div>
              </div>
            )
          }
        },
        {
          header: "Qtd. Molhado",
          accessor: "dmg_molhado",
          render: (val: number, item: any) => {
            const isTopQty = item.qtyRank <= 3
            const isVisualTop = item.rank <= 3
            const showHighlight = isVisualTop && isTopQty && sortMode === "qty_desc"

            if (showHighlight) {
              return (
                <span className={cn(
                  "px-3 py-1 rounded-xl transition-all border shrink-0",
                  item.rank === 1 ? "bg-blue-600 dark:bg-blue-700 text-white border-blue-500 dark:border-blue-600 shadow-md shadow-blue-100 dark:shadow-blue-900/20" :
                    item.rank === 2 ? "bg-blue-500 dark:bg-blue-600 text-white border-blue-400 dark:border-blue-500 shadow-sm" :
                      "bg-blue-400 dark:bg-blue-500 text-white border-blue-300 dark:border-blue-400"
                )}>
                  {fmtNum(val)}
                </span>
              )
            }

            return (
              <span className={cn(
                "px-2 transition-all text-slate-500 dark:text-slate-400",
                isTopQty ? "font-medium" : "font-medium"
              )}>
                {fmtNum(val)}
              </span>
            )
          }
        },
        {
          header: "% do Estoque",
          accessor: "dmg_molhado",
          render: (_: any, item: any) => {
            const val = item.dmg_molhado || 0
            const pct = Math.min((val / item.quantidade_total) * 100, 100)
            return (
              <div className="flex items-center gap-2 w-32">
                <div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50 transition-colors">
                  <div className="h-full bg-blue-500 dark:bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 transition-colors">{Math.round(pct)}%</span>
              </div>
            )
          }
        },
      ]
    }

    if (activeView === "nao_alocados") {
      return [
        {
          header: "Produto",
          accessor: "produto",
          render: (val: string) => (
            <span className="text-slate-500 dark:text-slate-400 tracking-tight transition-colors">
              {val || "Não Identificado"}
            </span>
          )
        },
        {
          header: "Descrição",
          accessor: "descricao",
          render: (val: string) => (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase truncate max-w-[200px] block transition-colors">
              {val || "-"}
            </span>
          )
        },
        { header: "Quantidade", accessor: "quantidade_total", render: (val: number) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)}</span> },
        {
          header: "ID Palete",
          accessor: "id_palete",
          render: (val: any) => {
            const invalid = !val || val === "" || String(val).toUpperCase() === "NAN" || val === "-" || val === "S/ID" || val === "N/A";
            return invalid ? (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">Palete Simples</span>
            ) : (
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 tracking-wide uppercase">{String(val).toUpperCase()}</span>
            );
          }
        },
        {
          header: "Observação",
          accessor: "observacao",
          render: (val: any) => {
            const strVal = val && val !== 0 ? String(val) : "-"
            const isCritical = strVal.endsWith("!")
            return (
              <span className={cn(
                "text-[10px] italic max-w-xs truncate block transition-all px-2 py-0.5 rounded-lg w-fit",
                isCritical
                  ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 shadow-sm shadow-red-50/50 not-italic"
                  : "text-slate-500 dark:text-slate-500"
              )}>
                {strVal}
              </span>
            )
          }
        },
      ]
    }

    return [
      {
        header: "Posição",
        accessor: "posicao",
        render: (val: string) => (
          <span className="text-slate-500 dark:text-slate-400 tracking-tight transition-colors">
            {val}
          </span>
        )
      },
      {
        header: "Principal SKU",
        accessor: "produto",
        render: (val: string) => (
          <span className="text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-tight">
            {val || "Não Identificado"}
          </span>
        )
      },
      {
        header: "Descrição",
        accessor: "descricao",
        render: (val: string) => (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase truncate max-w-[200px] block transition-colors">
            {val || "-"}
          </span>
        )
      },
      { header: "Capacidade", accessor: "capacidade", render: (val: any) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)} PTs</span> },
      { header: "Quantidade", accessor: "quantidade_total", render: (val: any) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)}</span> },
      { header: "Paletes", accessor: "paletes", render: (val: any) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)} PTs</span> },
      {
        header: "Ocupação",
        accessor: "ocupacao",
        render: (val: number) => (
          <div className="flex items-center gap-3 w-32">
            <div className="flex-1 h-1.5 rounded-full bg-slate-50 dark:bg-slate-800 overflow-hidden border border-slate-100 dark:border-slate-700 transition-colors">
              <div className={cn("h-full transition-all duration-1000",
                val >= 100 ? "bg-red-500" :
                  val >= 75 ? "bg-orange-500" :
                    "bg-blue-500"
              )} style={{ width: `${Math.min(val, 100)}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 transition-colors">{Math.round(val)}%</span>
          </div>
        )
      },
    ]
  }

  const positionDetail = useMemo(() => {
    if (!selectedPosition) return null

    const matches = data.filter(item => item.posicao === selectedPosition)
    if (matches.length === 0) return null

    // Determine the maximum level for the position
    const maxLevel = matches.reduce((max, item) => {
      const levels = String(item.nivel || "0").split(/[,;]/).map(l => parseInt(l.trim())).filter(n => !isNaN(n));
      return Math.max(max, ...levels);
    }, 0);

    const cap = Number(matches[0].capacidade) || 0;
    const pProf = Number(matches[0].prof_pos) || 0;
    const rawHeightStr = String(matches[0].altura_pos).trim();
    const pHeight = rawHeightStr !== "" && rawHeightStr !== "undefined" && rawHeightStr !== "NaN"
      ? Number(rawHeightStr) + 1
      : 0;

    // Height priority: 1. Registry value, 2. Calc from cap/prof, 3. Max observed level
    const finalLevelCount = pHeight || (pProf > 0 ? Math.ceil(cap / pProf) : maxLevel + 1);
    const finalMaxDepth = pProf || (finalLevelCount > 0 ? Math.ceil(cap / finalLevelCount) : 1);

    return {
      id: selectedPosition,
      capacidade: cap,
      level_count: finalLevelCount,
      max_depth: finalMaxDepth,
      occupied: matches.reduce((sum, item) => sum + (Number(item.paletes) || 0), 0),
      isOverflow: cap > 0 && Math.round(matches.reduce((sum, item) => sum + (Number(item.paletes) || 0), 0)) > Math.round(cap),
      is_blocked: matches[0].is_blocked || matches[0].status === "Fechado" || matches[0].status === "Bloqueado",
      observacao_pos: matches[0].observacao_pos || "",
      products: matches.map(m => ({
        id: m.id,
        sku: (m.paletes === 0 && (m.quantidade_total || 0) === 0 || !m.produto) ? "Posição Vazia" : m.produto,
        descricao: m.descricao || "-",
        nivel: (typeof m.nivel === 'number' || (typeof m.nivel === 'string' && !isNaN(parseFloat(m.nivel)))) ? Math.floor(Number(m.nivel)) : 0,
        quantidade: m.quantidade_total || 0,
        paletes: m.paletes || 0,
        profundidade: m.pos_interna || m.profundidade || m.Profundidade || "-",
        qtd_por_palete: m.qtd_por_palete || m["Quantidade/palete"] || 0,
        qtd_tombada: m.qtd_tombada || 0,
        qtd_molhado: m.qtd_molhado || 0,
        id_palete: m.id_palete || ""
      }))
    }
  }, [selectedPosition, data])

  const productDetail = useMemo(() => {
    if (!selectedProduct) return null

    const matches = data.filter(item => item.produto === selectedProduct)
    if (matches.length === 0) return null

    const filteredMatches = modalFilter
      ? matches.filter(m => (m.qtd_molhado || 0) > 0)
      : matches

    return {
      sku: selectedProduct,
      descricao: matches[0]?.descricao || "-",
      total_paletes: matches.reduce((sum, item) => sum + (item.paletes || 0), 0),
      total_quantidade: matches.reduce((sum, item) => sum + (item.quantidade_total || 0), 0),
      total_registros: filteredMatches.length,
      total_posicoes_unicas: new Set(filteredMatches.map(m => m.posicao)).size,
      positions: filteredMatches.map(m => ({
        posicao: m.posicao || "S/P",
        nivel: m.nivel || "Térreo",
        quantidade: m.quantidade_total || 0,
        paletes: m.paletes || 0,
        profundidade: m.profundidade || "-",
        qtd_tombada: m.qtd_tombada || 0,
        qtd_molhado: m.qtd_molhado || 0
      })).sort((a, b) => a.posicao.localeCompare(b.posicao))
    }
  }, [selectedProduct, data, modalFilter])

  const palletDetail = useMemo(() => {
    if (!selectedPalletId) return null
    const items = data.filter(item => item.id_palete?.toString()?.trim() === selectedPalletId)
    if (items.length === 0) return null

    const locations = Array.from(new Set(items.map(i => i.posicao || "S/P")))

    return {
      id: selectedPalletId,
      total_qty: items.reduce((sum, i) => sum + (i.quantidade_total || 0), 0),
      total_pallets: items.reduce((sum, i) => sum + (i.paletes || 0), 0),
      locations,
      items: items.sort((a, b) => (b.quantidade_total || 0) - (a.quantidade_total || 0))
    }
  }, [selectedPalletId, data])

  const handleExportProducts = () => {
    // Agora o botão apenas abre o modal de configuração
    setShowExportConfigModal(true)
    setShowExportMenu(false)
  }

  const executeProductExport = () => {
    // 1. Determina quais opções usar (Simples = TUDO, Avançado = State)
    const opts = exportTab === "simple"
      ? {
        includeWet: true,
        includeTilted: true,
        includeTraditional: true,
        includeAllocated: true,
        includeNotAllocated: true,
        includeNormal: true,
        includeDivergent: true,
        includeRejected: true,
        includeObservations: false
      }
      : exportOptions as any

    // 2. Filtrar os dados brutos com base nas opções
    let filteredData = data.filter(item => {
      const pos = String(item.posicao || "").toUpperCase()
      const isSP = !pos || pos === "S/P" || pos === "NÃO INFORMADO" || pos === "-"

      const descLine = String(item.produto_descricao || item.descricao || "").toUpperCase()
      const obsLine = String(item.observacao || "").toUpperCase()
      const fullText = `${descLine} ${obsLine}`

      const isRejected = fullText.includes("REJEITADO") || fullText.includes("REJEIÇÃO")
      const isDivergent = fullText.includes("DIVERGENTE") || fullText.includes("DIVERGÊNCIA")
      const isNormal = !isRejected && !isDivergent

      // 1. Filtro de Localização
      if (!opts.includeAllocated && !isSP) return false
      if (!opts.includeNotAllocated && isSP) return false

      // 2. Filtro de Status (Saldo)
      if (!opts.includeNormal && isNormal) return false
      if (!opts.includeDivergent && isDivergent) return false
      if (!opts.includeRejected && isRejected) return false

      // 3. Filtro de Auditoria (Importante: Rejeitado NÃO É Auditoria)
      const hasWetActual = (item.qtd_molhado || 0) > 0 && !isRejected
      const hasTiltedActual = (item.qtd_tombada || 0) > 0 && !isRejected
      const isTraditional = !hasWetActual && !hasTiltedActual && !isRejected

      let matchesDamage = false
      if (opts.includeWet && hasWetActual) matchesDamage = true
      if (opts.includeTilted && hasTiltedActual) matchesDamage = true
      if (opts.includeTraditional && isTraditional) matchesDamage = true

      if (isRejected && opts.includeRejected) matchesDamage = true

      return matchesDamage
    })

    // 3. Agregar por produto
    const productMap = new Map()
    filteredData.forEach(item => {
      // Robustez: aceitarmos múltiplas variações de chaves e tratar espaços
      const rawProd = item.produto || item.SKU || item.sku || item.codigo || item.sku_v || ""
      const prod = String(rawProd).trim()
      if (!prod || prod === "") return

      if (!productMap.has(prod)) {
        productMap.set(prod, {
          produto: prod,
          descricao: item.produto_descricao || item.descricao || "-",
          quantidade_total: 0,
          dmg_molhado: 0,
          dmg_tombada: 0,
          obsCounts: new Map(), // Mapeia obs -> total de itens com essa obs
          total_paletes: 0,
          positions: new Set()
        })
      }
      const entry = productMap.get(prod)
      const qty = Number(item.quantidade_total || 0)

      entry.quantidade_total += qty
      entry.dmg_molhado += Number(item.qtd_molhado || item.dmg_molhado || 0)
      entry.dmg_tombada += Number(item.qtd_tombada || item.dmg_tombada || 0)
      entry.total_paletes += Number(item.paletes || 0)

      // Rastrear posições únicas
      const pos = String(item.posicao || "").trim().toUpperCase()
      if (pos && pos !== "-" && pos !== "N/A") entry.positions.add(pos)

      if (opts.includeObservations) {
        const obs = String(item.observacao || item.Observação || "").trim()
        if (obs && obs !== "-" && obs.toUpperCase() !== "N/A") {
          entry.obsCounts.set(obs, (entry.obsCounts.get(obs) || 0) + qty)
        }
      }
    })

    // 4. Transformar em array, consolidar obs e ORDENAR CRESCENTE pelo SKU
    const productData = Array.from(productMap.values()).map(item => {
      // Formata observações: apenas o texto, sem quantidades prefixadas
      const obsFormatted = Array.from(item.obsCounts.keys())
        .join(", ") || "-"

      // Formata paletes: inteiro se >= 1, 1 casa decimal se < 1 (ex: 0.5)
      const pCount = Number(item.total_paletes || 0)
      const formattedPallets = pCount >= 1
        ? Math.floor(pCount).toString()
        : (pCount === 0 ? "0" : pCount.toFixed(1))

      return {
        ...item,
        observacao: obsFormatted,
        total_paletes: formattedPallets,
        total_posicoes: item.positions.size
      }
    }).sort((a, b) =>
      String(a.produto).localeCompare(String(b.produto), undefined, { numeric: true, sensitivity: 'base' })
    )

    if (productData.length === 0) {
      alert("Nenhum produto encontrado com os filtros selecionados.")
      return
    }

    if (exportFormat === "pdf") {
      setPrintData(productData)
      setIsExportingPDF(true)
      setShowExportConfigModal(false)
      setTimeout(() => {
        window.print()
        setTimeout(() => {
          setIsExportingPDF(false)
          setPrintData([])
        }, 500)
      }, 300)
    } else {
      // CSV/Excel Export Dinâmico
      const headers = ["Produto", "Descrição", "Peças Físicas", "Total Paletes", "Qtd. Posições"]
      if (opts.includeWet) headers.push("Qtd. Molhado")
      if (opts.includeTilted) headers.push("Qtd. Tombado")
      if (opts.includeObservations) headers.push("Observações")

      const csvRows = productData.map(p => {
        const row = [
          p.produto,
          `"${p.descricao.replace(/"/g, '""')}"`,
          p.quantidade_total,
          p.total_paletes,
          p.total_posicoes
        ]
        if (opts.includeWet) row.push(p.dmg_molhado)
        if (opts.includeTilted) row.push(p.dmg_tombada)
        if (opts.includeObservations) row.push(`"${p.observacao.replace(/"/g, '""')}"`)
        return row.join(";")
      })

      const csvContent = "\uFEFF" + headers.join(";") + "\n" + csvRows.join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      const timestamp = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      link.setAttribute("href", url)
      link.setAttribute("download", `relacao_produtos_${timestamp}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setShowExportConfigModal(false)
    }
  }

  const [printData, setPrintData] = useState<any[]>([])

  const handleExportMap = (mode: "all" | "filtered") => {
    const dataToPrint = mode === "all" ? data : filteredData
    setPrintData(dataToPrint)
    // Small timeout to allow state to settle before printing
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrintData([]), 500)
    }, 100)
  }

  const handleExportSelection = () => {
    if (selectedPositions.size === 0) return
    const dataToPrint = data.filter(item => selectedPositions.has(item.posicao))
    setPrintData(dataToPrint)
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrintData([]), 500)
    }, 100)
  }

  // Group data by position for the report
  const groupedPrintData = useMemo(() => {
    const groups: Record<string, any[]> = {}
    printData.forEach(item => {
      const pos = item.posicao || "S/P"
      if (!groups[pos]) groups[pos] = []
      groups[pos].push(item)
    })

    // Sort positions alpha-numerically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [printData])

  return (
    <div className="relative">
      {/* Printable Report (Hidden normally) */}
      {printData.length > 0 && (
        <div className="hidden print:block print:bg-white print:text-black print:p-2 print:w-full">
          {isExportingPDF ? (
            /* Layout 1: Relatório de Produtos (SKU Summary) */
            <div className="font-sans">
              <div className="flex justify-between items-center border-b-[2px] border-black pb-2 mb-6">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight">Relação de Produtos por Estoque</h1>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">G300 PAINEL OPERACIONAL</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase">{new Date().toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] font-bold text-blue-600 uppercase">{printData.length} SKUs Encontrados</p>
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-[10px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-2 text-left font-black uppercase w-24">SKU</th>
                    <th className="border border-black p-2 text-left font-black uppercase">Descrição</th>
                    <th className="border border-black p-2 text-center font-black uppercase w-16">Peças</th>
                    <th className="border border-black p-2 text-center font-black uppercase w-16">Paletes</th>
                    <th className="border border-black p-2 text-center font-black uppercase w-16">Posições</th>
                    <th className="border border-black p-2 text-left font-black uppercase w-48">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.map((item, idx) => (
                    <tr key={idx} className="border border-black">
                      <td className="border border-black p-2 font-bold">{item.produto}</td>
                      <td className="border border-black p-2 text-[9px]">{item.descricao}</td>
                      <td className="border border-black p-2 text-center font-bold">{fmtNum(item.quantidade_total)}</td>
                      <td className="border border-black p-2 text-center">{item.total_paletes}</td>
                      <td className="border border-black p-2 text-center">{item.total_posicoes}</td>
                      <td className="border border-black p-2 text-[8px] italic">{item.observacao || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-8 pt-4 border-t border-slate-200 text-center">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Documento interno para conferência operacional — AG G300</p>
              </div>
            </div>
          ) : (
            /* Layout 2: Manifesto de Conferência (By Position Mapping) */
            <>
              <div className="flex justify-between items-center border-b-[2px] border-black pb-1 mb-4">
                <h1 className="text-[16px] font-black uppercase tracking-tight">Manifesto de Conferência de Drive - G300</h1>
                <p className="text-[8px] font-bold text-slate-500 uppercase">{new Date().toLocaleString('pt-BR')} • {printData.length} Registros</p>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {groupedPrintData.map(([posId, items]) => {
                  const totalPosUnits = items.reduce((sum, i) => sum + (i.quantidade_total || i.quantidade || 0), 0);

                  // Group by Level
                  const levelGroups = new Map<string, any[]>();
                  items.forEach(item => {
                    const levels = String(item.nivel || "0").split(/[,;]/).map(l => l.trim()).filter(Boolean);
                    levels.forEach(lvl => {
                      if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
                      levelGroups.get(lvl)!.push(item);
                    });
                  });

                  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

                  if (sortedLevels.length === 0) return null;

                  return (
                    <div key={posId} className="avoid-break font-sans">
                      {/* Header */}
                      <div className="bg-[#E5E7EB] px-3 py-1 flex justify-between items-baseline border border-[#D1D5DB]">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[12px] font-black tracking-tight">{posId}</span>
                          <span className="text-[7px] font-bold uppercase opacity-60">Cap. {items[0]?.capacidade || "--"}</span>
                        </div>
                        <span className="text-[10px] font-bold">Qtd. Total: {fmtNum(totalPosUnits)}</span>
                      </div>

                      {/* Levels */}
                      <div className="space-y-1 mt-1">
                        {sortedLevels.map((lvl) => {
                          const levelItems = levelGroups.get(lvl)!;

                          // 1. Flatten items into individual depth entries
                          const depthPallets: { d: number, sku: string, portion: number }[] = [];
                          levelItems.forEach(item => {
                            const depths = String(item.profundidade || "").split(/[,;]/).map(d => parseInt(d.trim().replace(/\D/g, ""))).filter(n => !isNaN(n));
                            const levelsSpanned = String(item.nivel || "0").split(/[,;]/).map(l => l.trim()).filter(Boolean).length || 1;
                            const portion = (item.quantidade_total || item.quantidade || 0) / levelsSpanned;

                            depths.forEach(d => {
                              depthPallets.push({ d, sku: String(item.produto || "VAZIO").trim().toUpperCase(), portion });
                            });
                          });

                          // 2. Group by Depth (The physical pallet)
                          const palletMap = new Map<number, { sku: string, portion: number }[]>();
                          depthPallets.forEach(p => {
                            if (!palletMap.has(p.d)) palletMap.set(p.d, []);
                            palletMap.get(p.d)!.push({ sku: p.sku, portion: p.portion });
                          });

                          // 3. Group contiguous identical pallets
                          const sortedDepths = Array.from(palletMap.keys()).sort((a, b) => a - b);
                          const mergedGroups: { depths: number[], items: { sku: string, portion: number }[] }[] = [];

                          sortedDepths.forEach(d => {
                            const currentItems = palletMap.get(d)!.sort((a, b) => a.sku.localeCompare(b.sku));
                            const key = currentItems.map(i => `${i.sku}_${i.portion}`).join("|");

                            const lastGroup = mergedGroups[mergedGroups.length - 1];
                            const lastItemsSorted = lastGroup ? lastGroup.items.sort((a, b) => a.sku.localeCompare(b.sku)) : [];
                            const lastKey = lastGroup ? lastItemsSorted.map(i => `${i.sku}_${i.portion}`).join("|") : null;

                            if (lastGroup && key === lastKey) {
                              lastGroup.depths.push(d);
                            } else {
                              mergedGroups.push({ depths: [d], items: currentItems });
                            }
                          });

                          return (
                            <div key={lvl} className="flex items-stretch gap-1">
                              <div className="w-8 border border-black flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-black">N{lvl}</span>
                              </div>

                              <div className="flex-1 space-y-[-1px]">
                                {mergedGroups.map((group, gIdx) => {
                                  const pDepthsString = group.depths.sort((a, b) => a - b).join(", ");

                                  return (
                                    <div key={gIdx} className="flex border border-black min-h-[1.2rem] items-stretch">
                                      <div className="w-20 border-r border-black px-1.5 flex items-center justify-center shrink-0 bg-white">
                                        <span className="text-[9.5px] font-bold uppercase">P {pDepthsString || "-"}</span>
                                      </div>

                                      <div className="flex-1 flex flex-col">
                                        {group.items.map((item, iIdx) => (
                                          <div key={iIdx} className={`flex flex-1 ${iIdx > 0 ? 'border-t border-black' : ''}`}>
                                            <div className="flex-1 px-2 border-r border-black flex items-center min-w-0">
                                              <span className="text-[9.5px] font-black uppercase truncate">CÓD: {item.sku}</span>
                                            </div>
                                            <div className="w-24 px-2 flex items-center justify-end shrink-0">
                                              <span className="text-[12px] font-black">{fmtNum(item.portion)} UN</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body { background: white !important; padding: 0 !important; margin: 0 !important; font-family: -apple-system, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
          @page { margin: 0.8cm; size: portrait; }
          * { transition: none !important; color-adjust: exact; }
        }
      ` }} />

      <div className="flex min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-500 no-print relative">
        {/* Minimalist SideMenu */}
        <aside className="group/sidebar fixed left-0 top-0 z-50 flex h-full w-24 flex-col items-center border-r border-slate-200 bg-white/80 py-8 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 transition-all duration-300 hover:w-64 overflow-hidden">
          {/* Sidebar Branding (Combined) */}
          <div className="mb-12 flex flex-col items-center gap-4 px-4 w-full text-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-blue-600 shadow-xl shadow-blue-500/30">
              <Package className="text-white" size={32} />
            </div>
            <div className="flex flex-col items-center opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden w-full space-y-1">
              <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white leading-tight">Portal <span className="text-blue-600">AG</span></h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">G300 PAINEL OPERACIONAL</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-2 w-full px-3">
            {[
              { id: 'geral', label: 'Dashboard', icon: Layout },
              { id: 'mapeamento', label: 'Mapeamento', icon: MapPin },
              { id: 'produtos', label: 'Produtos', icon: Box },
              { id: 'confrontos', label: 'Confrontos', icon: GitCompare },
              ...(user ? [{ id: 'registros', label: 'Monitoramento', icon: History }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setTopTab(tab.id as any);
                  if (tab.id === 'produtos') setActiveView('produtos');
                  if (tab.id === 'geral') setActiveView('geral');
                }}
                className={cn(
                  "group relative flex h-12 w-full items-center rounded-xl transition-all duration-300",
                  topTab === tab.id
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 shadow-sm"
                    : "text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
                )}
              >
                {topTab === tab.id && (
                  <motion.div
                    layoutId="activeSideTabIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-md bg-blue-600 dark:bg-blue-500"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <div className="flex h-12 w-[48px] shrink-0 items-center justify-center">
                  <tab.icon size={20} className={cn(
                    "transition-all duration-300",
                    topTab === tab.id ? "text-blue-600 dark:text-blue-400" : ""
                  )} />
                </div>
                <span className={cn(
                  "text-[11px] font-black uppercase tracking-wider opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap text-left",
                  topTab === tab.id ? "text-blue-600 dark:text-blue-400" : ""
                )}>
                  {tab.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-4 w-full px-4 pb-8 items-center">
            <button
              onClick={toggleTheme}
              className="flex h-12 w-full items-center rounded-2xl text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 transition-colors overflow-hidden group/btn"
            >
              <div className="flex min-w-[48px] h-12 items-center justify-center">
                {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
              </div>
              <span className="ml-2 text-[10px] font-black uppercase tracking-wider opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                {theme === "light" ? "Escuro" : "Claro"}
              </span>
            </button>

            {/* User Avatar Section */}
            <div className="relative w-full flex flex-col items-center">
              <button
                onClick={user ? handleLogout : () => setShowLoginModal(true)}
                className={cn(
                  "group/avatar flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 border-2 shadow-lg active:scale-90",
                  user
                    ? "bg-slate-950 border-slate-700 text-white hover:border-blue-500 shadow-blue-500/10"
                    : "bg-slate-100 border-slate-200 text-slate-400 hover:bg-white hover:border-blue-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-700"
                )}
                title={user ? `Logado como ${user.email} - Clique para Sair` : "Fazer Login"}
              >
                {user ? (
                  <span className="text-sm font-black uppercase">{user.email[0]}</span>
                ) : (
                  <User size={20} />
                )}
              </button>
            </div>
          </div>
        </aside>

        <main className="ml-24 flex-1 p-4 md:p-8 lg:p-12 overflow-x-hidden">
          <div className="mx-auto max-w-7xl space-y-6 md:space-y-10">

            {/* Header - Simple & Clean */}
            <header className={cn(
              "flex flex-col gap-4 md:flex-row md:items-center mb-8 md:mb-10",
              topTab === 'confrontos' ? "md:justify-between" : "md:justify-end"
            )}>

              {/* LEFT: Confronto title - only when ready */}
              {topTab === 'confrontos' && !loadingConfrontos && (
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-700 dark:bg-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
                    <GitCompare size={18} />
                  </div>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap">Confronto de Saldos</span>
                </div>
              )}

              {/* RIGHT: action buttons */}
              <div className="flex items-center gap-3">
                {/* Divergence Tracking Toggle - Only visible on Dashboard */}
                {topTab === 'mapeamento' && (
                  <button
                    onClick={() => {
                      if (user) {
                        setShowDivergences(!showDivergences);
                      } else {
                        setShowLoginModal(true);
                      }
                    }}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-2xl transition-all border shrink-0",
                      showDivergences
                        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 shadow-inner"
                        : "bg-white dark:bg-slate-800 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 border-slate-200 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-900/50"
                    )}
                    title="Painel de Divergências"
                  >
                    <Search size={18} />
                  </button>
                )}

                {/* Confronto Type Toggle - Only visible on Confrontos tab when NOT loading */}
                {topTab === 'confrontos' && !loadingConfrontos && (
                  <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setConfrontoType("fisico_x_a501")}
                        className={cn(
                          "px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap",
                          confrontoType === "fisico_x_a501"
                            ? "bg-[#1E3A8A] dark:bg-blue-600 text-white shadow-sm"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                      >
                        Físico vs Sistema
                      </button>
                      <button
                        onClick={() => setConfrontoType("a501_x_g501")}
                        className={cn(
                          "px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap",
                          confrontoType === "a501_x_g501"
                            ? "bg-[#1E3A8A] dark:bg-blue-600 text-white shadow-sm"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                      >
                        A501 vs G501
                      </button>
                    </div>


                  </div>
                )}

                {/* Sync Button - only visible if NOT loading target tab data */}
                {((topTab === 'confrontos' && !loadingConfrontos) || (topTab !== 'confrontos' && !loading)) && (
                  <button
                    onClick={topTab === 'confrontos' ? () => fetchConfrontos() : () => fetchData()}
                    title="Sincronizar Dados"
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md active:scale-95"
                  >
                    <RefreshCw size={18} className={cn((topTab === 'confrontos' ? loadingConfrontos : loading) && "animate-spin")} />
                  </button>
                )}

                {/* ... menu - hidden when confrontos is loading */}
                {!(topTab === 'confrontos' && loadingConfrontos) && (
                  <div className="relative">
                    <button
                      onClick={() => setShowAjustesMenu(!showAjustesMenu)}
                      className={cn(
                        "group flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 h-[42px] w-[42px] transition-all border shrink-0",
                        showAjustesMenu
                          ? "text-blue-600 border-blue-200 dark:border-blue-900 shadow-lg shadow-blue-50 dark:shadow-blue-900/10"
                          : "text-slate-600 dark:text-slate-300 shadow-sm border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900"
                      )}
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    <AnimatePresence>
                      {showAjustesMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowAjustesMenu(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.9, filter: "blur(10px)" }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: 15, scale: 0.9, filter: "blur(10px)" }}
                            className="absolute right-0 mt-3 w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/20 dark:border-slate-800/50 z-50 origin-top-right overflow-hidden p-2"
                          >
                            <div className="px-4 py-3 mb-1">
                              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">
                                {topTab === 'confrontos' ? 'Filtro de Exportação' : 'Opções'}
                              </p>
                            </div>

                            {/* Export Filter Selector */}
                            {topTab === 'confrontos' && (
                              <div className="px-2 mb-3 space-y-1">
                                {[
                                  { id: "tudo", label: "Tudo" },
                                  { id: "positivado", label: "Positivado" },
                                  { id: "negativado", label: "Negativado" },
                                  { id: "batendo", label: "Batendo" },
                                  { id: "divergente", label: "Divergentes" }
                                ].map((f) => (
                                  <button
                                    key={f.id}
                                    onClick={() => setExportFilter(f.id as any)}
                                    className={cn(
                                      "w-full text-left px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                                      exportFilter === f.id
                                        ? "bg-blue-600 text-white shadow-sm"
                                        : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    )}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Exportar PDF do confronto atual */}
                            {topTab === 'confrontos' && confrontosData && (
                              <button
                                onClick={() => {
                                  setShowAjustesMenu(false);
                                  // Label for type
                                  const typeLabel = confrontoType === 'fisico_x_a501' ? 'Físico vs Sistema' : 'A501 vs G501';
                                  const filterLabel = exportFilter.charAt(0).toUpperCase() + exportFilter.slice(1);

                                  // Sort data by code ascending
                                  let data = [...confrontosData.dados].sort((a: any, b: any) =>
                                    a.produto.localeCompare(b.produto, undefined, { numeric: true, sensitivity: 'base' })
                                  );

                                  // Apply filters based on balance
                                  data = data.filter((c: any) => {
                                    const skuNormal = normalizeSku(c.produto);
                                    const ajusteSoma = ajustesConfronto.filter((a: any) => normalizeSku(a.produto) === skuNormal).reduce((acc, curr) => acc + curr.quantidade, 0);
                                    const qtdFisicaAjustada = c.qtd_fisica + ajusteSoma;
                                    const balance = qtdFisicaAjustada - c.qtd_sistema;

                                    if (exportFilter === "positivado") return balance > 0;
                                    if (exportFilter === "negativado") return balance < 0;
                                    if (exportFilter === "batendo") return balance === 0;
                                    if (exportFilter === "divergente") return balance !== 0;
                                    return true;
                                  });

                                  const rows = data.map((c: any) => {
                                    const skuNormal = normalizeSku(c.produto);
                                    const ajusteSoma = ajustesConfronto.filter((a: any) => normalizeSku(a.produto) === skuNormal).reduce((acc, curr) => acc + curr.quantidade, 0);
                                    const qtdFisicaAjustada = c.qtd_fisica + ajusteSoma;
                                    const diferenca = qtdFisicaAjustada - c.qtd_sistema;
                                    const saldo = diferenca === 0 ? 'Bateu' : diferenca > 0 ? `+${diferenca} (Positivo)` : `${diferenca} (Negativo)`;
                                    return `<tr><td>${c.produto}</td><td>${c.descricao}</td><td>${qtdFisicaAjustada}</td><td>${c.qtd_sistema}</td><td>${saldo}</td></tr>`;
                                  }).join('');

                                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Confronto ${typeLabel} - ${filterLabel}</title><style>body{font-family:sans-serif;font-size:12px;padding:20px}h2{margin-bottom:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#1e3a8a;color:white}tr:nth-child(even){background:#f8fafc}@media print{button{display:none}}</style></head><body><h2>Confronto de Saldos - ${typeLabel} (${filterLabel})</h2><p style="color:#64748b;margin-bottom:12px">Gerado em ${new Date().toLocaleString('pt-BR')}</p><table><thead><tr><th>Código</th><th>Descrição</th><th>Qtd Física</th><th>Qtd Sistema</th><th>Saldo</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
                                  const w = window.open('', '_blank');
                                  if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                                    <FileText size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none mb-1">Exportar PDF</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{confrontoType === 'fisico_x_a501' ? 'Físico vs Sistema' : 'A501 vs G501'}</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Exportar Excel do confronto atual */}
                            {topTab === 'confrontos' && confrontosData && (
                              <button
                                onClick={() => {
                                  if (!confrontosData?.dados) return;
                                  const typeLabel = confrontoType === 'fisico_x_a501' ? 'Fisico_vs_Sistema' : 'A501_vs_G501';
                                  const filterLabel = exportFilter;

                                  // Sort data by code ascending
                                  let data = [...confrontosData.dados].sort((a: any, b: any) =>
                                    a.produto.localeCompare(b.produto, undefined, { numeric: true, sensitivity: 'base' })
                                  );

                                  // Apply filters based on balance
                                  data = data.filter((c: any) => {
                                    const skuNormal = normalizeSku(c.produto);
                                    const ajusteSoma = ajustesConfronto.filter((a: any) => normalizeSku(a.produto) === skuNormal).reduce((acc, curr) => acc + curr.quantidade, 0);
                                    const qtdFisicaAjustada = c.qtd_fisica + ajusteSoma;
                                    const balance = qtdFisicaAjustada - c.qtd_sistema;

                                    if (exportFilter === "positivado") return balance > 0;
                                    if (exportFilter === "negativado") return balance < 0;
                                    if (exportFilter === "batendo") return balance === 0;
                                    if (exportFilter === "divergente") return balance !== 0;
                                    return true;
                                  });

                                  const rows = data.map((c: any) => {
                                    const skuNormal = normalizeSku(c.produto);
                                    const ajusteSoma = ajustesConfronto.filter((a: any) => normalizeSku(a.produto) === skuNormal).reduce((acc, curr) => acc + curr.quantidade, 0);
                                    const qtdFisicaAjustada = c.qtd_fisica + ajusteSoma;
                                    const diferenca = qtdFisicaAjustada - c.qtd_sistema;
                                    return `<tr><td>${c.produto}</td><td>${c.descricao}</td><td>${qtdFisicaAjustada}</td><td>${c.qtd_sistema}</td><td>${diferenca}</td></tr>`;
                                  }).join('');

                                  const xls = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Confronto</title><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Confronto</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table><thead><tr><th>Código</th><th>Descrição</th><th>Qtd Física</th><th>Qtd Sistema</th><th>Saldo</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
                                  const blob = new Blob([xls], { type: 'application/vnd.ms-excel;charset=utf-8;' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `confronto_${typeLabel}_${filterLabel}_${new Date().toISOString().slice(0, 10)}.xls`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                  setShowAjustesMenu(false);
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                    <Download size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none mb-1">Exportar Excel</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{confrontoType === 'fisico_x_a501' ? 'Físico vs Sistema' : 'A501 vs G501'}</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Importar A501 */}
                            {topTab === 'confrontos' && (
                              <button
                                onClick={() => {
                                  setShowAjustesMenu(false)
                                  setModalImportA501Open(true)
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                    <PlusSquare size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none mb-1">Importar A501</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Atualizar base do sistema</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Importar G501 */}
                            {topTab === 'confrontos' && (
                              <button
                                onClick={() => {
                                  setShowAjustesMenu(false)
                                  setModalImportG501Open(true)
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                    <Layers size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none mb-1">Importar G501</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Atualizar base de vistoria</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Importar Ajustes */}
                            {topTab === 'confrontos' && (
                              <button
                                onClick={() => {
                                  setShowAjustesMenu(false)
                                  setShowImportarAjustesModal(true)
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                                    <DownloadCloud size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none mb-1">Importar Ajustes</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Colar código compartilhado</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Relatório Geral - only on other tabs */}
                            {topTab !== 'confrontos' && (
                              <button
                                onClick={() => { handleExportProducts(); setShowAjustesMenu(false); }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                    <Package size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none mb-1">Relatório Geral</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Planilha Consolidada</p>
                                  </div>
                                </div>
                              </button>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </header >

            {/* GLOBAL LOADING INDICATOR (Phase 7) */}
            <AnimatePresence>
              {(loading || isRefreshing || (topTab === 'confrontos' && loadingConfrontos)) && !(topTab === 'confrontos' && loadingConfrontos && !confrontosData) && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                  animate={{ height: "auto", opacity: 1, marginBottom: 24 }}
                  exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-2xl transition-colors shadow-sm">
                    <RefreshCw size={12} className="animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Atualizando dados...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>





            <AnimatePresence mode="wait">
              {topTab === "geral" && (
                <motion.div
                  key="geral-content"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >


                  {error && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-900/20 bg-red-50 dark:bg-red-900/10 p-5 text-sm font-bold text-red-600 dark:text-red-400 shadow-xl shadow-red-100 dark:shadow-red-900/10 transition-colors">
                      <AlertCircle size={20} />
                      {error}
                    </motion.div>
                  )}




                  {/* KPIs Row */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                      title="Paletes Totais"
                      value={(globalStats?.total_pallets ?? stats?.total_pallets ?? 0).toLocaleString('pt-BR')}
                      icon={Package}
                      delay={0.1}
                      description={
                        palletTrend !== undefined ? (
                          <div className="flex items-center gap-1 mt-1 text-[10px] font-black uppercase tracking-wider">
                            <span className={cn(
                              "flex items-center gap-0.5",
                              palletTrend >= 0
                                ? "text-emerald-500 dark:text-emerald-400"
                                : "text-red-500 dark:text-red-400"
                            )}>
                              {palletTrend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {palletTrend >= 0 ? "+" : ""}{palletTrend.toLocaleString('pt-BR')}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 font-bold ml-1 tracking-widest leading-none">vs ontem</span>
                          </div>
                        ) : undefined
                      }
                      hoverContent={
                        <div className="flex items-center justify-around gap-10 text-center w-full">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Alocados</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 transition-colors">{fmtNum(advancedStats.alocadosPallets)}</span>
                          </div>
                          <div className="h-6 w-[1px] bg-slate-200 dark:bg-white/10" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Não Alocados</span>
                            <span className="text-sm font-black text-orange-600 dark:text-orange-400 transition-colors">{fmtNum(advancedStats.naoAlocadosPallets)}</span>
                          </div>
                        </div>
                      }
                    />
                    <MetricCard
                      title={
                        <div className="flex items-center gap-2">
                          Peças Totais
                        </div>
                      }
                      value={(() => {
                        const val = globalStats?.absolute_total_quantity ?? stats?.absolute_total_quantity ?? 0;
                        if (val === 0 && loading) return "Sincronizando...";
                        if (val === 0) return "Sem dados";
                        return val.toLocaleString('pt-BR');
                      })()}
                      icon={BarChart3}

                      delay={0.2}
                      description={
                        (() => {
                          const todayNet = stats?.today_net ?? 0;
                          const delta = todayNet;
                          
                          return (
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-black uppercase tracking-wider">
                              <span className={cn(
                                "flex items-center gap-0.5",
                                delta > 0
                                  ? "text-emerald-500 dark:text-emerald-400"
                                  : delta < 0
                                  ? "text-red-500 dark:text-red-400"
                                  : "text-slate-400 dark:text-slate-500"
                              )}>
                                {delta > 0 ? <TrendingUp size={10} /> : delta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                                {delta > 0 ? "+" : ""}{delta.toLocaleString('pt-BR')}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500 font-bold ml-1 tracking-widest leading-none">vs ontem</span>
                            </div>
                          );
                        })()
                      }
                      hoverContent={
                        <div className="grid grid-cols-2 gap-x-10 gap-y-4 text-center w-full">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Alocadas</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 transition-colors">{fmtNum(data.filter(i => {
                              const p = String(i.posicao || "").toUpperCase();
                              return p !== "CHÃO" && p !== "CHAO";
                            }).reduce((s, i) => s + (i.quantidade_total || 0), 0))}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Não Alocadas</span>
                            <span className="text-sm font-black text-orange-600 dark:text-orange-400 transition-colors">{fmtNum(data.filter(i => {
                              const p = String(i.posicao || "").toUpperCase();
                              return p === "CHÃO" || p === "CHAO";
                            }).reduce((s, i) => s + (i.quantidade_total || 0), 0))}</span>
                          </div>
                          <div className="col-span-2 h-[1px] bg-slate-200 dark:bg-white/10 my-1" />
                          <div className="flex flex-col border-r border-slate-200 dark:border-white/10 pr-6">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Molhados</span>
                            <span className="text-sm font-black text-blue-600 dark:text-blue-400 transition-colors">{fmtNum(stats?.qtd_molhado || 0)} <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">un</span></span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Tombadas</span>
                            <span className="text-sm font-black text-red-600 dark:text-red-400 transition-colors">{fmtNum(stats?.qtd_tombada || 0)} <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">un</span></span>
                          </div>
                        </div>
                      }
                    />
                    <MetricCard
                      title="Drive-in ativos"
                      value={advancedStats.totalPositions}
                      icon={ShieldCheck}
                      delay={0.1}
                      hoverContent={
                        <div className="flex items-center justify-around gap-8 text-center w-full">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Completos</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 transition-colors">{advancedStats.completoCount}</span>
                          </div>
                          <div className="h-6 w-[1px] bg-slate-200 dark:bg-white/10" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Disponíveis</span>
                            <span className="text-sm font-black text-blue-600 dark:text-blue-400 transition-colors">{advancedStats.disponivelCount}</span>
                          </div>
                        </div>
                      }
                    />
                    <MetricCard
                      title="SKUs Ativos"
                      value={(globalStats?.absolute_total_skus ?? stats?.absolute_total_skus ?? 0).toLocaleString('pt-BR')}
                      icon={TrendingUp}
                      delay={0.4}
                    />
                  </div>

                  {/* Analytics Section — Locked Height 330px */}
                  <div className="grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-3">
                    {/* Capacity Donut */}
                    <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-6 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors h-[330px] flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">CAPACIDADE FÍSICA</h3>
                          <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 tracking-widest mt-1">VOL. GEOGRÁFICO G300</p>
                        </div>
                        <History size={18} className="text-slate-400 dark:text-slate-600" />
                      </div>
                      <div className="flex flex-col items-center justify-center h-full pb-4">
                        <div className="group/donut relative h-40 w-40 cursor-help">
                          {/* Overlay de Composição no Hover */}
                          <div className="opacity-0 group-hover/donut:opacity-100 absolute inset-[-10%] bg-slate-950/98 backdrop-blur-xl rounded-[2.5rem] flex flex-col items-center justify-center transition-all duration-300 z-30 scale-95 group-hover/donut:scale-100 border border-white/20 p-5 shadow-2xl">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">COMPOSIÇÃO</span>
                            <div className="w-full space-y-2">
                              {advancedStats.breakdown.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center border-b border-white/10 pb-1.5 last:border-0">
                                  <span className="text-[9px] font-black text-slate-400 uppercase">{item.count} DRIVE-IN DE</span>
                                  <span className="text-[10px] font-black text-white">{item.capacity}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                            <circle className="text-slate-50 dark:text-slate-800" strokeWidth="8" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50" />
                            <motion.circle className="text-blue-600 dark:text-blue-500" strokeWidth="8" strokeDasharray={2 * Math.PI * 42} initial={{ strokeDashoffset: 2 * Math.PI * 42 }} animate={{ strokeDashoffset: (2 * Math.PI * 42) * (1 - advancedStats.occupiedPercent / 100) }} strokeLinecap="round" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center group-hover/donut:opacity-0 transition-opacity duration-200">
                            <span className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">{Math.round(advancedStats.occupiedPercent)}%</span>
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1">USO</span>
                          </div>
                        </div>

                        {/* Métricas Compactas no Rodapé */}
                        <div className="mt-auto w-full flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/50">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-0.5">TOTAL</span>
                            <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight">{advancedStats.totalCapacity.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-0.5">USADO</span>
                            <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight">{advancedStats.occupied.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-0.5">LIVRE</span>
                            <span className="text-[11px] font-black text-emerald-500 tracking-tight">{advancedStats.free.toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Histórico de Paletes Card */}
                    <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-6 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors h-[330px] flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">HISTÓRICO</h3>
                          <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 tracking-widest mt-1">CRESCIMENTO DE PALETES</p>
                        </div>
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl">
                          <button
                            onClick={() => setPalletHistoryFilter('hoje')}
                            className={cn("px-2 py-1 text-[8px] font-black uppercase rounded-lg transition-all", palletHistoryFilter === 'hoje' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400")}
                          >
                            Hoje
                          </button>
                          <button
                            onClick={() => setPalletHistoryFilter('dias')}
                            className={cn("px-2 py-1 text-[8px] font-black uppercase rounded-lg transition-all", palletHistoryFilter === 'dias' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400")}
                          >
                            Dias
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-6 flex-1 justify-center scrollbar-hide py-2">
                        {palletHistoryFilter === "hoje" ? (
                          <>
                             <div className="grid grid-cols-3 items-center">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400/80 uppercase tracking-widest mb-0.5">MANHÃ</span>
                                <span className="text-xs font-black text-slate-900 dark:text-slate-100 tracking-tight">14:20</span>
                              </div>
                              <div className="flex flex-col items-center">
                                {(() => {
                                  const now = new Date();
                                  const hour = now.getHours();
                                  const min = now.getMinutes();
                                  const pastTime = hour > 14 || (hour === 14 && min >= 20);

                                  if (palletHistory.t14 === 0) {
                                    if (!pastTime) {
                                      return (
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                                          Aguardando
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="text-[9px] font-black text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                                        Não apurado
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                                      {palletHistory.t14.toLocaleString('pt-BR')}
                                      <span className="text-[10px] font-medium text-slate-400 ml-1">Paletes</span>
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center justify-end">
                                {(() => {
                                  const diff = palletHistory.t14 - palletHistory.prevT22;
                                  if (palletHistory.t14 === 0) return <span className="text-[9px] font-bold text-slate-400">-</span>;
                                  if (palletHistory.prevT22 === 0) return <span className="text-[9px] font-bold text-slate-400">-</span>;
                                  return (
                                    <div className={cn("flex flex-col items-end gap-0", diff >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                                      <div className="flex items-center gap-0.5 text-xs font-black">
                                        {diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        {diff >= 0 ? '+' : ''}{diff}
                                      </div>
                                      <span className="text-[7px] font-black opacity-60 uppercase">Vs ontem</span>
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 items-center">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400/80 uppercase tracking-widest mb-0.5">TARDE</span>
                                <span className="text-xs font-black text-slate-900 dark:text-slate-100 tracking-tight">17:00</span>
                              </div>
                              <div className="flex flex-col items-center">
                                {(() => {
                                  const now = new Date();
                                  const hour = now.getHours();
                                  const pastTime = hour >= 17;

                                  if (palletHistory.t17 === 0) {
                                    if (!pastTime) {
                                      return (
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                                          Aguardando
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="text-[9px] font-black text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                                        Não apurado
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                                      {palletHistory.t17.toLocaleString('pt-BR')}
                                      <span className="text-[10px] font-medium text-slate-400 ml-1">Paletes</span>
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center justify-end">
                                {(() => {
                                  const diff = palletHistory.t17 - palletHistory.t14;
                                  if (palletHistory.t17 === 0) return <span className="text-[9px] font-bold text-slate-400">-</span>;
                                  if (palletHistory.t14 === 0) return <span className="text-[9px] font-bold text-slate-400">-</span>;
                                  return (
                                    <div className={cn("flex flex-col items-end gap-0", diff >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                                      <div className="flex items-center gap-0.5 text-xs font-black">
                                        {diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        {diff >= 0 ? '+' : ''}{diff}
                                      </div>
                                      <span className="text-[7px] font-black opacity-60 uppercase">Vs 14:20</span>
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 items-center">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400/80 uppercase tracking-widest mb-0.5">FECHAMENTO</span>
                                <span className="text-xs font-black text-slate-900 dark:text-slate-100 tracking-tight">22:20</span>
                              </div>
                              <div className="flex flex-col items-center">
                                {(() => {
                                  const nowHour = new Date().getHours();
                                  const nowMin = new Date().getMinutes();
                                  const pastClosing = nowHour > 22 || (nowHour === 22 && nowMin >= 20);
                                  if (palletHistory.t22 === 0 && !pastClosing) {
                                    return (
                                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                                        Aguardando
                                      </span>
                                    );
                                  }
                                  if (palletHistory.t22 === 0 && pastClosing) {
                                    return (
                                      <span className="text-[9px] font-black text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                                        Não apurado
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                                      {palletHistory.t22.toLocaleString('pt-BR')}
                                      <span className="text-[10px] font-medium text-slate-400 ml-1">Paletes</span>
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center justify-end">
                                {(() => {
                                  const diff = palletHistory.t22 - palletHistory.t17;
                                  if (palletHistory.t22 === 0) return <span className="text-[9px] font-bold text-slate-400">-</span>;
                                  if (palletHistory.t17 === 0) return <span className="text-[9px] font-bold text-slate-400">-</span>;
                                  return (
                                    <div className={cn("flex flex-col items-end gap-0", diff >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                                      <div className="flex items-center gap-0.5 text-xs font-black">
                                        {diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        {diff >= 0 ? '+' : ''}{diff}
                                      </div>
                                      <span className="text-[7px] font-black opacity-60 uppercase">Vs 17:00</span>
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {dailyHistoryRecords.length > 0 ? (
                              dailyHistoryRecords.slice(0, 15).map((record, index) => {
                                const olderRecord = dailyHistoryRecords[index + 1];
                                const diff = olderRecord ? record.value - olderRecord.value : null;
                                const recordDate = new Date(record.date + "T00:00:00");
                                const weekday = recordDate.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
                                
                                return (
                                  <div key={record.date} className="grid grid-cols-3 items-center border-b border-slate-100 dark:border-slate-800/30 pb-1 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                        {recordDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                      </span>
                                      <span className="text-[8px] font-black text-slate-400 uppercase">{weekday}</span>
                                    </div>

                                  <div className="flex justify-center">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                                      {record.value.toLocaleString('pt-BR')} 
                                      <span className="text-[8px] font-medium text-slate-400 ml-0.5">Paletes</span>
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-end">
                                    {diff !== null ? (
                                      <div className={cn("flex items-center gap-1", diff >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                                        <span className="text-[9px] font-black">
                                          {diff >= 0 ? '+' : ''}{diff}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[7px] font-black text-slate-300 dark:text-slate-700 uppercase">BASE</span>
                                    )}
                                  </div>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="flex flex-col items-center justify-center h-[180px] text-center">
                                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mb-2">
                                  <BarChart3 size={16} className="text-slate-300 dark:text-slate-600" />
                                </div>
                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                  Nenhum registro
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* Top 3 SKUs Card */}
                    <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-6 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors h-[330px] flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">TOP 3 SKUS</h3>
                          <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 tracking-widest mt-1">
                            {topSkusFilter === "geral" ? "QUANTIDADE GERAL" : topSkusFilter === "molhado" ? "MOLHADOS/TOMBADOS" : "INCIDÊNCIA DE REG"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl">
                          <button
                            onClick={() => setTopSkusFilter('geral')}
                            className={cn("px-2 py-1 text-[8px] font-black uppercase rounded-lg transition-all", topSkusFilter === 'geral' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400")}
                          >
                            Geral
                          </button>
                          <button
                            onClick={() => setTopSkusFilter('molhado')}
                            className={cn("px-2 py-1 text-[8px] font-black uppercase rounded-lg transition-all", topSkusFilter === 'molhado' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400")}
                          >
                            Crit.
                          </button>
                          <button
                            onClick={() => setTopSkusFilter('incidencia')}
                            className={cn("px-2 py-1 text-[8px] font-black uppercase rounded-lg transition-all", topSkusFilter === 'incidencia' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400")}
                          >
                            Reg.
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col justify-center space-y-3 overflow-y-auto scrollbar-hide py-1">
                        {topSkus.length > 0 ? (
                          topSkus.slice(0, 3).map((item: any, index: number) => (
                            <div key={item.sku} className="flex items-center justify-between group/sku p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xs text-slate-400 group-hover/sku:bg-blue-500 group-hover/sku:text-white transition-colors">
                                  {index + 1}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-black tracking-tight uppercase truncate text-slate-700 dark:text-slate-200">
                                      {item.sku}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate leading-tight">
                                    {item.descricao}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[8px] font-black text-blue-500/60 dark:text-blue-400/40 uppercase tracking-widest">
                                      {item.posicoesCount} POSIÇÕES
                                    </span>
                                    <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                      {Math.round(item.paletes)} PALETES
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="px-3 py-1.5 rounded-xl font-black text-[11px] tracking-tight min-w-[70px] text-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {topSkusSort === "incidencia"
                                  ? `${item.incidencia} REG`
                                  : fmtNum(topSkusFilter === "molhado" ? item.molhados : item.quantidade)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-10 flex flex-col items-center justify-center opacity-20 dark:opacity-50">
                            <Box size={32} className="mb-2 text-slate-400 dark:text-slate-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Aguardando dados...</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  {/* MOVEMENTS & CHÃON */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT: CHART */}
                    <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-4 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                              Fluxo de Registros
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-widest">
                                {`VOLUME TOTAL DO PERÍODO: ${movementPeriod.toUpperCase()}`}
                              </p>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-tighter">Entradas:</span>
                                  <span className="text-[9px] font-black text-emerald-500 dark:text-emerald-400">
                                    {stats?.period_entries?.toLocaleString('pt-BR') || "0"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-tighter">Saídas:</span>
                                  <span className="text-[9px] font-black text-orange-500 dark:text-orange-400">
                                    {stats?.period_exits?.toLocaleString('pt-BR') || "0"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setShowMovementMenu(!showMovementMenu)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-600"
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          <AnimatePresence>
                            {showMovementMenu && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowMovementMenu(false)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                  className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-20 p-1.5"
                                >
                                  {[
                                    { id: "hoje", label: "Hoje" },
                                    { id: "semana", label: "Semanal" },
                                    { id: "mensal", label: "Mensal" }
                                  ].map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => {
                                        setMovementPeriod(p.id as any)
                                        setShowMovementMenu(false)
                                      }}
                                      className={cn(
                                        "w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors",
                                        movementPeriod === p.id
                                          ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                                          : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                                      )}
                                    >
                                      {p.label}
                                    </button>
                                  ))}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="flex-1 relative mt-4">
                        {/* Y-Axis */}
                        <div className="absolute left-8 top-0 bottom-6 w-[1px] bg-slate-100 dark:bg-slate-800/50" />
                        {/* X-Axis */}
                        <div className="absolute left-8 right-0 bottom-6 h-[1px] bg-slate-100 dark:bg-slate-800/50" />

                        {/* Background Grid Lines */}
                        <div className="absolute left-8 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none opacity-50">
                          {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="w-full h-[1px] bg-slate-50 dark:bg-slate-800/30 border-t border-dashed border-slate-100/50 dark:border-slate-800/20" />
                          ))}
                        </div>

                        <div className="flex items-end justify-center gap-1.5 h-full pl-10 pr-4 pb-6">
                          {stats?.period_movements && stats.period_movements.length > 0 ? (() => {
                            const isIndividual = movementPeriod === "hoje";
                            const isWeekly = movementPeriod === "semana";
                            const isMonthly = movementPeriod === "mensal";

                            let chartItems: any[] = [];

                            if (isIndividual) {
                              const skuGroups: Record<string, { val: number, molhado: number, m: any }> = {};
                              stats?.period_movements?.forEach((m: any) => {
                                const sku = m.produto;
                                if (!skuGroups[sku]) {
                                  skuGroups[sku] = { val: 0, molhado: 0, m };
                                }
                                skuGroups[sku].val += m.movimentacao;
                                skuGroups[sku].molhado += (m.molhado || 0);
                              });

                              chartItems = Object.entries(skuGroups).map(([sku, data]) => ({
                                label: sku.split(' ')[0],
                                sublabel: data.m.entrada_val > 0 ? "ENTRADAS" : "SAÍDAS",
                                mov: data.m.entrada_val > 0 ? "ENT" : "SAÍ",
                                val: data.val,
                                molhado: data.molhado,
                                isEntrada: data.m.entrada_val > 0,
                                details: [{ sku, val: data.val, molhado: data.molhado }],
                                date: data.m.data || "Hoje"
                              })).sort((a, b) => b.val - a.val).slice(0, 10);
                            }
                            else if (isWeekly) {
                              const diasSemana = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
                              const groups: Record<string, { label: string, date: string, ent: { val: number, molh: number, items: any[] }, sai: { val: number, molh: number, items: any[] } }> = {};

                              const today = new Date();
                              const day = today.getDay(); 
                              const diffToMonday = today.getDate() - (day === 0 ? 6 : day - 1);
                              const monday = new Date(today.setDate(diffToMonday));

                              for (let i = 0; i < 7; i++) {
                                const d = new Date(monday);
                                d.setDate(monday.getDate() + i);
                                const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                groups[dateStr] = {
                                  label: diasSemana[i],
                                  date: dateStr,
                                  ent: { val: 0, molh: 0, items: [] },
                                  sai: { val: 0, molh: 0, items: [] }
                                };
                              }

                              stats?.period_movements?.forEach((m: any) => {
                                const key = m.data ? m.data.slice(0, 10).split('-').reverse().join('/') : null;
                                if (key && groups[key]) {
                                  if (m.entrada_val > 0) {
                                    groups[key].ent.val += m.entrada_val;
                                    groups[key].ent.molh += (m.molhado || 0);
                                    groups[key].ent.items.push({ sku: m.produto, val: m.entrada_val, molhado: m.molhado || 0 });
                                  }
                                  if (m.saida_val > 0) {
                                    groups[key].sai.val += m.saida_val;
                                    groups[key].sai.molh += (m.molhado || 0);
                                    groups[key].sai.items.push({ sku: m.produto, val: m.saida_val, molhado: m.molhado || 0 });
                                  }
                                }
                              });

                              Object.values(groups).forEach(g => {
                                const dayItems: any[] = [];
                                if (g.ent.val > 0) dayItems.push({ label: g.label, sublabel: "ENTRADAS", mov: "ENT", val: g.ent.val, molhado: g.ent.molh, isEntrada: true, details: g.ent.items, date: g.date, isLastOfDay: false });
                                if (g.sai.val > 0) dayItems.push({ label: g.label, sublabel: "SAÍDAS", mov: "SAÍ", val: g.sai.val, molhado: g.sai.molh, isEntrada: false, details: g.sai.items, date: g.date, isLastOfDay: false });
                                if (dayItems.length === 0) dayItems.push({ label: g.label, sublabel: "-", mov: "-", val: 0, molhado: 0, isEntrada: true, details: [], date: g.date, isEmpty: true, isLastOfDay: false });
                                if (dayItems.length > 0) dayItems[dayItems.length - 1].isLastOfDay = true;
                                chartItems.push(...dayItems);
                              });
                            }
                            else if (isMonthly) {
                              const monthNames = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
                              const groups: Record<string, { label: string, year: number, month: number, ent: { val: number, items: any[] }, sai: { val: number, items: any[] } }> = {};

                              stats.period_movements.forEach((m: any) => {
                                if (!m.data) return;
                                const parts = m.data.split('-');
                                if (parts.length < 3) return;
                                const [y, mon] = parts.map(Number);
                                const monthIdx = mon - 1;
                                const key = `${y}-${String(mon).padStart(2, '0')}`;
                                if (!groups[key]) {
                                  groups[key] = { label: monthNames[monthIdx], year: y, month: mon, ent: { val: 0, items: [] }, sai: { val: 0, items: [] } };
                                }
                                if (m.entrada_val > 0) {
                                  groups[key].ent.val += m.entrada_val;
                                  groups[key].ent.items.push({ sku: m.produto, val: m.entrada_val, molhado: m.molhado || 0 });
                                }
                                if (m.saida_val > 0) {
                                  groups[key].sai.val += m.saida_val;
                                  groups[key].sai.items.push({ sku: m.produto, val: m.saida_val, molhado: m.molhado || 0 });
                                }
                              });

                              Object.values(groups).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month).forEach(g => {
                                let hasEntries = false;
                                if (g.ent.val > 0) {
                                  chartItems.push({ label: g.label, sublabel: "ENTRADAS", mov: "ENT", val: g.ent.val, molhado: 0, isEntrada: true, details: g.ent.items, date: String(g.year), isLastOfDay: false });
                                  hasEntries = true;
                                }
                                if (g.sai.val > 0) {
                                  chartItems.push({ label: g.label, sublabel: "SAÍDAS", mov: "SAÍ", val: g.sai.val, molhado: 0, isEntrada: false, details: g.sai.items, date: String(g.year), isLastOfDay: true });
                                } else if (hasEntries) {
                                  const last = chartItems[chartItems.length - 1];
                                  if (last) last.isLastOfDay = true;
                                }
                              });
                            }

                            const maxVal = Math.max(...chartItems.map(i => i.val), 10);
                            const groupedItems: any[][] = [];
                            let currentGroup: any[] = [];
                            chartItems.forEach((item, idx) => {
                              if (idx === 0 || (item.date === chartItems[idx - 1].date && item.label === chartItems[idx - 1].label)) {
                                currentGroup.push(item);
                              } else {
                                groupedItems.push(currentGroup);
                                currentGroup = [item];
                              }
                            });
                            if (currentGroup.length > 0) groupedItems.push(currentGroup);

                            return groupedItems.map((group, gIdx) => {
                              const firstItem = group[0];
                              const isLastGroup = gIdx === groupedItems.length - 1;
                              const showSeparator = firstItem.isLastOfDay && !isLastGroup;
                              const shortDate = firstItem.date && firstItem.date.includes('/') ? firstItem.date.split('/').slice(0, 2).join('/') : firstItem.date;

                              return (
                                <React.Fragment key={gIdx}>
                                  <div className={cn("flex flex-col flex-1 min-w-0 max-w-[160px] pb-2 relative", showSeparator && "border-r border-slate-100 dark:border-slate-800/40 mr-1")}>
                                    <div className="flex items-end justify-center gap-1 h-24 mb-2">
                                      {group.map((item, iIdx) => {
                                        const hPct = (item.val / maxVal) * 100;
                                        return (
                                          <div key={iIdx} className={cn("relative flex flex-col items-center justify-end group/bar", isIndividual ? "w-10" : "flex-1")} style={{ height: '100%' }}>
                                            {item.val > 0 && (
                                              <span className={cn("absolute text-[10px] font-black pointer-events-none transition-all drop-shadow-sm z-20", item.isEntrada ? "text-emerald-500" : "text-orange-500")} style={{ bottom: `calc(${hPct}% + 6px)` }}>
                                                {item.isEntrada ? `+${item.val}` : item.val}
                                              </span>
                                            )}
                                            <motion.div initial={{ height: 0 }} animate={{ height: `${hPct}%` }} className={cn("w-full rounded-t-xl rounded-b-md relative", item.val === 0 ? "h-0.5 bg-slate-100 dark:bg-slate-800" : item.isEntrada ? "bg-gradient-to-t from-emerald-600 to-emerald-400" : "bg-gradient-to-t from-orange-600 to-orange-400")}>
                                              {item.val > 0 && <div className="absolute inset-x-0 top-0 h-1 bg-white/20 rounded-full mx-1 mt-1 blur-[1px]" />}
                                              {item.val > 0 && (
                                                <div className="absolute opacity-0 group-hover/bar:opacity-100 transition-opacity z-[100] bottom-full left-1/2 -translate-x-1/2 mb-4">
                                                  <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 p-2.5 rounded-2xl shadow-2xl min-w-[140px]">
                                                    <div className="flex items-center justify-between mb-2">
                                                      <span className="text-[10px] font-black text-white uppercase">{item.label}</span>
                                                      <span className={cn("text-[9px] font-black", item.isEntrada ? "text-emerald-400" : "text-orange-400")}>{item.isEntrada ? "ENTRADA" : "SAÍDA"}</span>
                                                    </div>
                                                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                                                      {item.details?.slice(0, 5).map((d: any, di: number) => (
                                                        <div key={di} className="flex flex-col gap-0.5 border-l-2 border-slate-700 pl-2">
                                                          <div className="flex items-center justify-between gap-2">
                                                            <span className="text-[9px] font-black text-slate-300 truncate">{d.sku}</span>
                                                            <span className="text-[9px] font-black text-white">{item.isEntrada ? "+" : "-"}{d.val}</span>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </motion.div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex flex-col items-center shrink-0 w-full overflow-hidden">
                                      <span className="text-[7.5px] font-black text-slate-900 dark:text-slate-100 uppercase truncate text-center w-full">{firstItem.label}</span>
                                      <span className="text-[8px] font-black text-blue-500 truncate w-full text-center mt-0.5">{shortDate}</span>
                                      <div className="flex justify-center gap-2 w-full mt-1">
                                        {group.map((it, idx) => (
                                          <span key={idx} className="text-[6px] font-bold text-slate-400 dark:text-slate-600 uppercase text-center">{it.sublabel}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            });
                          })() : (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-8">
                              <div className="relative">
                                <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center">
                                  <BarChart3 size={22} className="text-slate-300 dark:text-slate-600" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center border-2 border-white dark:border-[#0F172A]">
                                  <span className="text-[10px]">📭</span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                  {movementPeriod === "hoje" ? "Sem movimentações hoje" : movementPeriod === "semana" ? "Sem movimentações esta semana" : "Sem movimentações este mês"}
                                </p>
                                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                  Nenhum registro de entrada ou saída encontrado
                                </p>
                              </div>
                              {movementPeriod === "hoje" && (
                                <button
                                  onClick={() => setMovementPeriod("semana")}
                                  className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors border border-blue-500/20 hover:border-blue-400/30 px-3 py-1.5 rounded-xl"
                                >
                                  {"Ver semana →"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    {/* RIGHT: LIST */}
                    <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-4 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors overflow-hidden flex flex-col min-h-[320px]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                              Últimas Movimentações
                            </h3>
                          </div>
                        </div>
                        <Activity size={18} className="text-slate-400 dark:text-slate-600" />
                      </div>

                      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                        {stats?.latest_movements && stats.latest_movements.length > 0 ? (
                          <div className="flex flex-col">
                            {/* Header Row */}
                            <div className="grid grid-cols-[60px_100px_1fr_60px_80px] gap-4 px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                              <div>Data</div>
                              <div>Código</div>
                              <div>Descrição</div>
                              <div className="text-right">Qtd</div>
                              <div className="text-right">Origem</div>
                            </div>

                            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                              {stats.latest_movements.slice(0, 5).map((mov: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-[60px_100px_1fr_60px_80px] gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors items-center">
                                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    {mov.data || "-"}
                                  </div>
                                  <div className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate">
                                    {mov.produto}
                                  </div>
                                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate" title={mov.descricao}>
                                    {mov.descricao && mov.descricao !== "-" ? mov.descricao : "Sem Descrição"}
                                  </div>
                                  <div className={cn(
                                    "text-right text-[11px] font-black",
                                    mov.entrada ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"
                                  )}>
                                    {mov.entrada ? "+" : "-"}{mov.movimentacao}
                                  </div>

                                  <div className="text-right text-[9px] font-black uppercase tracking-tight text-slate-400 dark:text-slate-500">
                                    {mov.origem !== "-" ? mov.origem : "N/I"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center opacity-20 dark:opacity-50 py-10">
                            <History size={40} className="mb-2 text-slate-400 dark:text-slate-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Nenhuma movimentação</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>

                </motion.div>
              )}

              {(topTab === "produtos") && (
                <motion.div
                  key="produtos-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  {/* View Selection & Filters for Products */}
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between py-2 transition-colors overflow-hidden">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit max-w-full overflow-x-auto hide-scrollbar border border-slate-200/50 dark:border-slate-800/50 transition-colors">
                      <button
                        onClick={() => { setActiveView("produtos"); setSortMode("none"); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-black transition-all shrink-0 whitespace-nowrap",
                          activeView === "produtos" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        <Tag size={14} /> Produtos
                      </button>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20 rounded-2xl w-fit max-w-full transition-colors">
                      <button
                        onClick={() => { setActiveView("molhados"); setSortMode("none"); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-black transition-all relative group shrink-0 whitespace-nowrap",
                          activeView === "molhados" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        )}
                      >
                        <Droplet size={14} className={cn(activeView === "molhados" ? "fill-white/20" : "fill-blue-500/20 animate-pulse")} /> Molhados
                        {activeView !== "molhados" && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl transition-colors border border-slate-200/50 dark:border-slate-800/50">
                        <button onClick={() => { setSortMode("qty_desc"); setTableSort({ key: "none", direction: "asc" }); }} className={cn("px-4 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all", sortMode === "qty_desc" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
                          <ArrowDownWideNarrow size={14} className="inline mr-1" /> Maior Qtd.
                        </button>
                        <button onClick={() => { setSortMode("alpha_asc"); setTableSort({ key: "none", direction: "asc" }); }} className={cn("px-4 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all", sortMode === "alpha_asc" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
                          <ArrowDownAZ size={14} className="inline mr-1" /> A-Z
                        </button>
                      </div>
                      <div className="relative w-full md:w-auto group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 transition-colors group-focus-within:text-blue-500" size={16} />
                        <input type="text" placeholder="Pesquisar detalhes..." className="w-full md:w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-11 pr-5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-500 dark:focus:border-blue-900 transition-all font-medium shadow-sm transition-colors" value={search} onChange={(e) => setSearch(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* --- MAIN DATA VIEW --- */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeView}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      <div className="rounded-3xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-slate-950/50 overflow-x-auto custom-scrollbar transition-colors">
                        <div className="min-w-[800px] lg:min-w-full">
                          <WarehouseTable
                            columns={getColumns()}
                            data={paginatedData}
                            delay={0.1}
                            onRowClick={(row) => {
                              if (activeView === "produtos") {
                                setModalFilter(false)
                                setSelectedProduct(row.produto)
                              }
                              if (activeView === "molhados") {
                                setModalFilter(true)
                                setSelectedProduct(row.produto)
                              }
                            }}
                            sortConfig={tableSort}
                            onSort={handleSort}
                          />
                        </div>
                      </div>

                      {!loading && totalPages >= 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 pb-12 transition-colors">
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest order-2 sm:order-1">
                            {rowsPerPage === 'ALL' ? `Exibindo todos os ${filteredData.length} itens` : `Página ${currentPage} de ${totalPages}`}
                          </span>
                          <div className="flex gap-3 order-1 sm:order-2 items-center">
                            <button 
                              onClick={() => {
                                setRowsPerPage(prev => prev === 'ALL' ? 10 : 'ALL')
                                setCurrentPage(1)
                              }}
                              className="px-4 py-2 sm:px-3 sm:py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            >
                              {rowsPerPage === 'ALL' ? "Voltar ao padrão" : "Ver todos"}
                            </button>
                            {rowsPerPage !== 'ALL' && (
                              <>
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95 transition-colors"><ChevronLeft size={18} /></button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95 transition-colors"><ChevronRight size={18} /></button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}

              {topTab === "mapeamento" && (
                <motion.div
                  key="mapeamento-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  {/* Global Summary Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <MetricCard
                      title="Peças Totais"
                      value={(globalStats?.absolute_total_quantity || 0).toLocaleString('pt-BR')}
                      icon={Package}
                    />
                    <MetricCard
                      title="SKUs Ativos"
                      value={(globalStats?.absolute_total_skus || 0).toLocaleString('pt-BR')}
                      icon={Tag}
                    />
                    <MetricCard
                      title="Drive-in Ativos"
                      value={advancedStats.totalPositions.toLocaleString('pt-BR')}
                      icon={Layers}
                    />
                    <MetricCard
                      title="Paletes Mistos"
                      value={mixedPalletsData.length.toLocaleString('pt-BR')}
                      icon={Box}
                    />
                    <MetricCard
                      title="Pendências"
                      value={(globalStats?.pendenciasCount || 0).toLocaleString('pt-BR')}
                      icon={AlertTriangle}
                    />
                  </div>

                  {/* Analytics Grid Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                    {/* NEW Capacity Card (Left) */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="rounded-[2.5rem] bg-white dark:bg-slate-900/50 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden relative group transition-colors"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                        <MapPin size={120} className="text-blue-500" />
                      </div>

                      <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                              Capacidade de Drives
                              <div className="group/tip relative flex items-center">
                                <Info size={14} className="text-slate-400 dark:text-slate-500 cursor-help" />
                                <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-white/10 dark:border-white/10 z-[100]">
                                  Ocupação física total do Armazém
                                </div>
                              </div>
                            </h3>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ocupação Física</p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                              <span className="text-slate-400 dark:text-slate-500">Drives Ocupados</span>
                              <span className="text-slate-900 dark:text-white">{advancedStats.totalPositions - advancedStats.vazioCount} / {advancedStats.totalPositions}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${((advancedStats.totalPositions - advancedStats.vazioCount) / (advancedStats.totalPositions || 1)) * 100}%` }}
                                className="h-full bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                              <span className="text-slate-400 dark:text-slate-500">Capacidade Total</span>
                              <span className="text-slate-900 dark:text-white">{(advancedStats.occupiedPercent || 0).toFixed(1)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${advancedStats.occupiedPercent || 0}%` }}
                                className="h-full bg-slate-400 rounded-full shadow-[0_0_15px_rgba(148,163,184,0.3)]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* MODIFIED Mix Card (Right) */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="rounded-[2.5rem] bg-white dark:bg-slate-900/50 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden relative group transition-colors"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                        <Layers size={120} className="text-orange-500" />
                      </div>

                      <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                              Distribuição de Mix
                              <div className="group/tip relative flex items-center">
                                <Info size={14} className="text-slate-400 dark:text-slate-500 cursor-help" />
                                <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-white/10 dark:border-white/10 z-[100]">
                                  Volume de Mono-produto vs Mixed SKUs
                                </div>
                              </div>
                            </h3>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Eficiência de Armazenagem</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 items-end">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                <span className="text-slate-400 dark:text-slate-500">Mono</span>
                                <span className="text-slate-900 dark:text-white">{(100 - (advancedStats.mixPercent || 0)).toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-8/12 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${100 - (advancedStats.mixPercent || 0)}%` }}
                                  className="h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                <span className="text-slate-400 dark:text-slate-500">Mix</span>
                                <span className="text-slate-900 dark:text-white">{(advancedStats.mixPercent || 0).toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-8/12 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${advancedStats.mixPercent || 0}%` }}
                                  className="h-full bg-orange-500 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4 border-l border-slate-100 dark:border-white/5 pl-8">
                            <div>
                              <span className="text-3xl font-black text-emerald-500 tracking-tighter leading-none">{advancedStats.totalMono}</span>
                              <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tight mt-1">Organizados</p>
                            </div>
                            <div>
                              <span className="text-3xl font-black text-orange-500 tracking-tighter leading-none">{advancedStats.totalMixed}</span>
                              <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tight mt-1">Críticos</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* REFINED FILTER BAR */}
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between py-6 border-y border-slate-100 dark:border-slate-800 transition-colors">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit border border-slate-200/50 dark:border-slate-800/50">
                      <button
                        onClick={() => { setDisplayMode("mapa"); setActiveView("geral"); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black transition-all",
                          displayMode === "mapa" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        <MapPin size={14} /> MAPA
                      </button>
                      <button
                        onClick={() => { setDisplayMode("tabela"); setActiveView("posicoes"); setTableSort({ key: "posicao", direction: "asc" }); setSortMode("none"); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black transition-all",
                          displayMode === "tabela" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        <LayoutGrid size={14} /> TABELA
                      </button>
                      <button
                        onClick={() => { setDisplayMode("misto"); setActiveView("geral"); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black transition-all",
                          displayMode === "misto" ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        <Layers size={14} /> PALETES MISTOS
                      </button>
                      <button
                        onClick={() => { setDisplayMode("nao_alocados"); setActiveView("nao_alocados"); setSortMode("none"); setTableSort({ key: "produto", direction: "asc" }); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] uppercase font-black transition-all",
                          displayMode === "nao_alocados" ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        <AlertCircle size={14} /> Não alocados
                      </button>
                    </div>

                    {/* Middle Legend (Map Only with Counts) */}
                    <div className="hidden lg:flex items-center justify-center gap-8 flex-1 px-8">
                      {displayMode === "mapa" && (
                        <>
                          <div className="flex items-center gap-2.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              VAZIO <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.vazioCount}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-[#2D5A27] shadow-[0_0_8px_rgba(45,90,39,0.4)]" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              DISPONÍVEL <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.totalPositions - advancedStats.lotadoCount - advancedStats.vazioCount}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-[#7F1D1D] shadow-[0_0_8px_rgba(127,29,29,0.4)]" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              LOTADO <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.lotadoCount}</span>
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {displayMode === "tabela" && (
                        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                          <button
                            onClick={() => setSortMode("qty_desc")}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-3 py-1.5 text-[9px] font-black transition-all",
                              sortMode === "qty_desc" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                            <TrendingDown size={14} /> MAIOR QTD.
                          </button>
                          <button
                            onClick={() => setSortMode("alpha_asc")}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-3 py-1.5 text-[9px] font-black transition-all",
                              sortMode === "alpha_asc" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                            <ArrowDownAZ size={14} /> A-Z
                          </button>
                        </div>
                      )}

                      <div className="relative group w-full sm:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input
                          type="text"
                          placeholder="Pesquisar no mapeamento..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full h-11 pl-11 pr-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
                        />
                      </div>

                      {/* Map Options Button */}
                      {displayMode === "mapa" && (
                        <div className="relative">
                          <button
                            onClick={() => setMapMenuOpen(v => !v)}
                            title="Opções de Exportação"
                            className={cn(
                              "flex items-center justify-center h-11 w-11 rounded-2xl border transition-all active:scale-95",
                              mapMenuOpen
                                ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 shadow-sm"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shadow-sm"
                            )}
                          >
                            <MoreHorizontal size={20} />
                          </button>

                          <AnimatePresence>
                            {mapMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className="absolute right-0 top-[120%] z-50 origin-top-right"
                              >
                                <div className="flex flex-col gap-2 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl min-w-[240px]">
                                  <button
                                    onClick={() => { handleExportMap("all"); setMapMenuOpen(false); }}
                                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all group"
                                    title="Imprimir mapa completo"
                                  >
                                    <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                      <Printer size={16} />
                                    </div>
                                    <div className="flex flex-col items-start text-left">
                                      <span className="text-[11px] font-black uppercase tracking-tight">Imprimir Tudo</span>
                                      <span className="text-[9px] font-medium opacity-60">Mapa completo (PDF)</span>
                                    </div>
                                  </button>

                                  {user && (
                                    <button
                                      onClick={() => {
                                        const newMode = !selectionModeActive;
                                        setSelectionModeActive(newMode);
                                        if (!newMode) setSelectedPositions(new Set());
                                        setMapMenuOpen(false);
                                      }}
                                      className={cn(
                                        "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group",
                                        selectionModeActive ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                      )}
                                      title={selectionModeActive ? "Desativar seleção manual" : "Selecionar posições manualmente"}
                                    >
                                      <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                        selectionModeActive ? "bg-blue-600 text-white" : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white"
                                      )}>
                                        <CheckSquare size={16} />
                                      </div>
                                      <div className="flex flex-col items-start text-left">
                                        <span className="text-[11px] font-black uppercase tracking-tight">
                                          {selectionModeActive ? "Sair da Seleção" : "Escolher Posições"}
                                        </span>
                                        <span className="text-[9px] font-medium opacity-60">Escolha manual para impressão</span>
                                      </div>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => { handleExportMap("filtered"); setMapMenuOpen(false); }}
                                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all group"
                                    title="Imprimir apenas resultados filtrados"
                                  >
                                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                                      <FileText size={16} />
                                    </div>
                                    <div className="flex flex-col items-start text-left">
                                      <span className="text-[11px] font-black uppercase tracking-tight">Imprimir Filtro</span>
                                      <span className="text-[9px] font-medium opacity-60">Apenas resultados atuais</span>
                                    </div>
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </div>

                  {displayMode === "misto" && (
                    <div className="space-y-4">
                      {/* Header with count and sort controls */}
                      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                            <Layers size={16} />
                          </div>
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                            {mixedPalletsData.length}
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1">
                              {mixedPalletsData.length === 1 ? "palete misto" : "paletes mistos"}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                          <button
                            onClick={() => setMixedSort("name_asc")}
                            title="Nome (A → Z)"
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                              mixedSort === "name_asc" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                          >
                            <ChevronUp size={12} /> Nome
                          </button>
                          <button
                            onClick={() => setMixedSort("name_desc")}
                            title="Nome (Z → A)"
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                              mixedSort === "name_desc" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                          >
                            <ChevronDown size={12} /> Nome
                          </button>
                          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                          <button
                            onClick={() => setMixedSort("sku_desc")}
                            title="Mais SKUs primeiro"
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                              mixedSort === "sku_desc" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                          >
                            <ChevronDown size={12} /> SKUs
                          </button>
                          <button
                            onClick={() => setMixedSort("sku_asc")}
                            title="Menos SKUs primeiro"
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                              mixedSort === "sku_asc" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                          >
                            <ChevronUp size={12} /> SKUs
                          </button>
                        </div>
                      </div>

                      {/* Pallet cards grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {mixedPalletsData.length === 0 ? (
                          <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors flex flex-col items-center justify-center">
                            <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-800">
                                <Box size={32} className="text-slate-300 dark:text-slate-700" />
                            </div>
                            <h4 className="text-base font-black text-slate-800 dark:text-slate-200 mb-2">Ambiente Organizado</h4>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-600 max-w-[280px] mx-auto">Nenhum palete misto detectado no mapeamento atual. Todo o estoque está segregado por SKU.</p>
                          </div>
                        ) : (
                          mixedPalletsData.map((pallet) => (
                            <motion.div
                              key={pallet.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={() => setSelectedPalletId(pallet.id)}
                              className="group cursor-pointer rounded-[2.5rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm transition-all hover:border-orange-300 dark:hover:border-orange-900/50 hover:shadow-2xl hover:shadow-orange-100/50 dark:hover:shadow-orange-950/20 flex flex-col gap-4"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 rounded-2xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 border border-orange-100/50 dark:border-orange-900/30 transition-colors">
                                    <Layers size={20} />
                                  </div>
                                  <div>
                                    <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">{pallet.id}</h4>
                                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 transition-colors">ID PALETE</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">{fmtNum(pallet.totalQty)}</p>
                                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 transition-colors">Peças</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 py-0.5 transition-colors">
                                {pallet.isMixedSku && (
                                  <span className="px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[10px] font-black uppercase border border-red-100 dark:border-red-900/40 flex items-center gap-1.5 transition-colors"><AlertCircle size={10} /> {pallet.skuCount} SKUs</span>
                                )}
                                {pallet.isMixedStatus && (
                                  <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase border border-blue-100 dark:border-blue-900/40 flex items-center gap-1.5 transition-colors"><MapPin size={10} /> Misto Aloc/SP</span>
                                )}
                              </div>

                                <div className="space-y-4 mt-auto pt-4 border-t border-slate-50 dark:border-slate-800 transition-colors">
                                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <span>Produtos no Palete</span>
                                    <div className="flex items-center gap-1 text-orange-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                      <span className="text-[9px]">DETALHES</span>
                                      <ChevronRight size={10} />
                                    </div>
                                  </div>
                                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed transition-colors">
                                    {pallet.skus.join(", ")}
                                  </p>
                                  
                                  {user && (
                                    <div className="pt-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (user) {
                                            setUngroupTargetData({ id: pallet.id, itemIds: pallet.items.map((item: any) => item.id) });
                                            setShowUngroupConfirm(true);
                                          } else {
                                            setShowLoginModal(true);
                                          }
                                        }}
                                        disabled={isProcessingGroup}
                                        className="w-full py-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100"
                                      >
                                        <X size={12} /> Desagrupar Palete
                                      </button>
                                    </div>
                                  )}
                                </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  {displayMode === "mapa" && (
                    <>
                      {advancedStats.overflowPositions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-8 flex flex-col md:flex-row items-center justify-between gap-6 rounded-[2.5rem] bg-gradient-to-br from-red-600 to-rose-700 p-8 text-white shadow-2xl shadow-red-500/30 border border-white/20 relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <AlertCircle size={120} />
                          </div>

                          <div className="flex items-center gap-6 relative z-10">
                            <div className="h-16 w-16 rounded-[1.25rem] bg-white/20 flex items-center justify-center backdrop-blur-xl shrink-0 ring-1 ring-white/30">
                              <AlertCircle size={32} className="text-white animate-pulse" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-black uppercase tracking-tight">Erro de Mapeamento Detectado</h2>
                                <div className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-black uppercase tracking-widest border border-white/30">Alerta Crítico</div>
                              </div>
                              <p className="text-xs font-bold uppercase text-red-100/90 tracking-widest leading-relaxed max-w-xl">
                                Identificamos posições com capacidade excedida. Isso pode causar problemas na sincronização: <span className="text-white underline decoration-white/30 underline-offset-4">{advancedStats.overflowPositions.join(", ")}</span>
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleVerNoMapa(advancedStats.overflowPositions[0])}
                            className="px-8 py-4 bg-white text-red-600 hover:bg-red-50 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all shadow-xl hover:shadow-2xl active:scale-95 shrink-0 ring-1 ring-black/5"
                          >
                            Ver no Mapa
                          </button>
                        </motion.div>
                      )}

                      <div id="warehouse-map" className="space-y-6">
                        {/* Global Map Summary */}
                        {(() => {
                          const allStreetPositions = Object.values(streetData).flatMap(sections => Object.values(sections).flat());
                          const activeStreetPositions = allStreetPositions.filter((p: any) => !p.is_blocked && p.status !== "Fechado" && p.status !== "Bloqueado");
                          const globalCap = Math.round(activeStreetPositions.reduce((acc, p) => acc + (p.capacidade || 0), 0));
                          const globalUso = Math.round(activeStreetPositions.reduce((acc, p) => acc + (p.paletes || 0), 0));
                          const globalLivre = Math.max(0, globalCap - globalUso);
                          const globalOccupancy = globalCap > 0 ? (globalUso / globalCap) * 100 : 0;

                          return (
                            <div className="p-5 rounded-[1.5rem] bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden group/global">
                              <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
                              <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

                              <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                                    <Warehouse size={24} />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-black text-white tracking-tight uppercase">Resumo Geral do Armazém</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Monitoramento em Tempo Real</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-8">
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Capacidade Total</span>
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-2xl font-black text-white tabular-nums tracking-tighter">{fmtNum(globalCap)}</span>
                                      <span className="text-[10px] font-bold text-slate-500 uppercase">PTs</span>
                                    </div>
                                  </div>
                                  <div className="h-8 w-px bg-slate-800" />
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Total em Uso</span>
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-2xl font-black text-emerald-400 tabular-nums tracking-tighter">{fmtNum(globalUso)}</span>
                                      <span className="text-[10px] font-bold text-emerald-900 uppercase">PTs</span>
                                    </div>
                                  </div>
                                  <div className="h-8 w-px bg-slate-800" />
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Vagas Livres</span>
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-2xl font-black text-blue-400 tabular-nums tracking-tighter">{fmtNum(globalLivre)}</span>
                                      <span className="text-[10px] font-bold text-blue-900 uppercase">Vagas</span>
                                    </div>
                                  </div>
                                  <div className="h-8 w-px bg-slate-800" />
                                  <div className="flex flex-col items-end">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Ocupação</span>
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-2xl font-black text-white tabular-nums tracking-tighter">{Math.round(globalOccupancy)}%</span>
                                      <div className={cn(
                                        "h-1.5 w-10 rounded-full",
                                        globalOccupancy >= 95 ? "bg-red-500" : globalOccupancy >= 80 ? "bg-amber-500" : "bg-emerald-500"
                                      )} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })()}

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-8">
                          {Object.entries(streetData).map(([streetName, sections]) => {
                            const allPositions = Object.values(sections).flat();
                            const activePositionsOnly = allPositions.filter((p: any) => !p.is_blocked && p.status !== "Fechado" && p.status !== "Bloqueado");
                            const lotadoPos = activePositionsOnly.filter((p: any) => Math.round(p.paletes) >= Math.round(p.capacidade) && Math.round(p.capacidade) > 0).length;
                            const disponivelPos = activePositionsOnly.filter((p: any) => Math.round(p.paletes) > 0 && Math.round(p.paletes) < Math.round(p.capacidade)).length;
                            const vazioPos = activePositionsOnly.filter((p: any) => Math.round(p.paletes) === 0).length;

                            const totalUso = Math.round(activePositionsOnly.reduce((acc: number, p: any) => acc + (p.paletes || 0), 0));
                            const totalCap = Math.round(activePositionsOnly.reduce((acc: number, p: any) => acc + (p.capacidade || 0), 0));
                            const occupancyPercent = totalCap > 0 ? (totalUso / totalCap) * 100 : 0;

                            return (
                              <div key={streetName} className="p-4 md:p-6 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors relative group/card hover:shadow-xl dark:hover:shadow-slate-950/40 transition-all duration-300">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                                  <div className="flex items-center gap-4">
                                    <div className="flex overflow-hidden rounded-lg shadow-sm border border-black/5 dark:border-white/5">
                                      <div className="bg-slate-200 dark:bg-slate-800 px-3 py-1.5 flex items-center justify-center font-black text-slate-700 dark:text-slate-300 text-[13px] tracking-tight border-r border-slate-300 dark:border-slate-700">{streetName}</div>
                                      <div className="bg-slate-100 dark:bg-slate-700 px-4 py-1.5 flex items-center justify-center font-black text-slate-500 dark:text-slate-400 text-[11px] tracking-widest uppercase">Bloco</div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-6">
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-red-600" /> LOTADOS
                                      </span>
                                      <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{lotadoPos}</p>
                                    </div>
                                    <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> DISPONÍVEIS
                                      </span>
                                      <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{disponivelPos}</p>
                                    </div>
                                    <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-slate-500" /> VAZIOS
                                      </span>
                                      <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{vazioPos}</p>
                                    </div>
                                    <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">OCUPAÇÍO</span>
                                      <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{Math.round(occupancyPercent)}%</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">CAPACIDADE TOTAL</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-base font-black text-slate-900 dark:text-white leading-none tracking-tight">{totalCap}</span>
                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">PTs</span>
                                      </div>
                                    </div>
                                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700/50" />
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">EM USO</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-none tracking-tight">{totalUso}</span>
                                        <span className="text-[9px] font-bold text-emerald-600/50 dark:text-emerald-400/50 uppercase">PTs</span>
                                      </div>
                                    </div>
                                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700/50" />
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">ESPAÇO LIVRE</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-base font-black text-blue-600 dark:text-blue-400 leading-none tracking-tight">{Math.max(0, totalCap - totalUso)}</span>
                                        <span className="text-[9px] font-bold text-blue-600/50 dark:text-blue-400/50 uppercase">Vagas</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="hidden sm:flex flex-col items-end">
                                    <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-0.5">Status Global</span>
                                    <div className={cn(
                                      "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border",
                                      occupancyPercent >= 95 ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30" :
                                        occupancyPercent >= 80 ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" :
                                          "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                                    )}>
                                      {occupancyPercent >= 95 ? "Crítico" : occupancyPercent >= 80 ? "Alto volume" : "Operacional"}
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 relative">
                                  <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-100 dark:bg-slate-800/60" />

                                  {Object.entries(sections).map(([side, positions]) => {
                                    const sideCapacity = positions.reduce((acc: number, p: any) => (p.is_blocked || p.status === "Fechado" || p.status === "Bloqueado") ? acc : acc + (p.capacidade || 0), 0);
                                    const sideUsage = positions.reduce((acc: number, p: any) => (p.is_blocked || p.status === "Fechado" || p.status === "Bloqueado") ? acc : acc + (p.paletes || 0), 0);
                                    const sideAvailable = Math.max(0, sideCapacity - sideUsage);

                                    return (
                                      <div key={side} className="space-y-4 relative z-10 py-1">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-4 gap-2">
                                          <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest leading-none">Lado {side === "even" ? "PAR" : "ÍMPAR"}</p>
                                          <div className="flex items-center gap-3">
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">CAP: <span className="text-slate-700 dark:text-slate-300">{Math.round(sideCapacity)}</span></span>
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">USO: <span className="text-slate-700 dark:text-slate-300">{Math.round(sideUsage)}</span></span>
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">LIVRE: <span className="text-slate-700 dark:text-slate-300">{Math.round(sideAvailable)}</span></span>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {positions.map((pos: any) => {
                                            const isFull = pos.capacidade > 0 && Math.round(pos.paletes) >= Math.round(pos.capacidade)
                                            const isOverflow = pos.capacidade > 0 && Math.round(pos.paletes) > Math.round(pos.capacidade)
                                            const isSelected = selectedPositions.has(pos.id)
                                            const displayNum = pos.id.match(/(\d+)$/)?.[1]?.slice(-3) || pos.id.slice(-3);

                                            return (
                                              <div key={pos.id} className="group relative">
                                                <button
                                                  onClick={() => {
                                                    if (selectionModeActive) {
                                                      const newSelection = new Set(selectedPositions)
                                                      if (newSelection.has(pos.id)) newSelection.delete(pos.id)
                                                      else newSelection.add(pos.id)
                                                      setSelectedPositions(newSelection)
                                                    } else {
                                                      setSelectedPosition(pos.id)
                                                    }
                                                  }}
                                                  className={cn(
                                                    "h-10 w-10 rounded-md border-2 flex items-center justify-center transition-all active:scale-95 relative",
                                                    pos.id === blinkPosition && "animate-pulse ring-4 ring-red-500 ring-offset-2 dark:ring-offset-slate-900 border-red-600 scale-110 z-20",
                                                    pos.status === "Fechado"
                                                      ? "bg-slate-100 dark:bg-slate-800/10 border-slate-300 dark:border-slate-700 text-slate-400 grayscale border-dashed"
                                                      : pos.unregistered_error
                                                        ? "bg-red-900/10 border-red-900 text-red-900 shadow-[0_0_10px_rgba(127,29,29,0.1)]"
                                                        : isOverflow
                                                          ? "bg-red-900/10 border-red-900 text-red-900 shadow-[0_0_10px_rgba(127,29,29,0.1)]"
                                                          : isFull
                                                            ? "bg-transparent border-red-900/70 dark:border-red-900/30 text-red-600 dark:text-red-500"
                                                            : pos.paletes === 0
                                                              ? "bg-slate-50 dark:bg-slate-800/10 border-slate-200 dark:border-slate-800/50 text-slate-400 dark:text-slate-600"
                                                              : "bg-transparent border-emerald-900/70 dark:border-emerald-600/30 text-emerald-800 dark:text-emerald-500",
                                                    isSelected && !blinkPosition && "ring-4 ring-blue-500/30 border-blue-600 z-10 scale-105"
                                                  )}
                                                >
                                                  {pos.status === "Fechado" ? (
                                                    <Lock size={12} className="opacity-50" />
                                                  ) : (
                                                    <span className="text-[11px] font-mono font-black tracking-tighter leading-none">
                                                      {displayNum}
                                                    </span>
                                                  )}
                                                </button>

                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[300] w-60 pointer-events-none">
                                                  <div className="bg-slate-950/98 text-white rounded-2xl p-4 shadow-2xl border border-white/10 backdrop-blur-xl relative ring-1 ring-white/5">
                                                    <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{pos.id}</span>
                                                      <div className={cn("h-3 w-3 rounded-full ring-2 ring-white/10", isFull ? "bg-red-500" : "bg-emerald-500")} />
                                                    </div>
                                                    <div className="space-y-3">
                                                      <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                                        <span>Ocupação</span>
                                                        <span className="text-white text-[12px] font-black">
                                                          {pos.is_blocked ? "BLOQUEADO" : pos.unregistered_error ? "ERRO" : `${Math.round(pos.paletes)}/${Math.round(pos.capacidade)} PTs`}
                                                        </span>
                                                      </div>
                                                      {pos.status === "Fechado" && pos.observacao_pos && (
                                                        <div className="pt-2 border-t border-white/5">
                                                          <p className="text-[9px] font-black text-rose-400 uppercase mb-1">Observação</p>
                                                          <p className="text-[11px] font-medium text-slate-200 leading-tight italic break-words">
                                                            {pos.observacao_pos}
                                                          </p>
                                                        </div>
                                                      )}
                                                      {pos.products.length > 0 && (
                                                        <div className="pt-2 border-t border-white/5">
                                                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Item no Slot</p>
                                                          <p className="text-[12px] font-black text-slate-100 truncate leading-tight tracking-tight">{pos.products[0].sku}</p>
                                                          {pos.products.length > 1 && (
                                                            <div className="mt-2 py-1 px-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-1.5">
                                                              <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-tight">+ {pos.products.length - 1} ITENS (SKU MIX)</p>
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-950/98" />
                                                  </div>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                  {
                    displayMode === "nao_alocados" && (() => {
                      // --- Group items by pallet id ---
                      const INVALID = (v: any) => !v || v === "" || String(v).toUpperCase() === "NAN" || v === "-" || v === "S/ID" || v === "N/A";
                      const grouped: { key: string; label: string; isSimple: boolean; items: any[] }[] = [];
                      const seen = new Map<string, number>(); // id -> index in grouped
                      let simpleCount = 0;
                      paginatedData.forEach((item: any) => {
                        const rawId = item.id_palete;
                        if (INVALID(rawId)) {
                          // Each simple pallet is its own row
                          const key = `__simple_${simpleCount++}_${item.id}`;
                          grouped.push({ key, label: "Palete Simples", isSimple: true, items: [item] });
                        } else {
                          const id = String(rawId).toUpperCase();
                          if (seen.has(id)) {
                            grouped[seen.get(id)!].items.push(item);
                          } else {
                            seen.set(id, grouped.length);
                            grouped.push({ key: id, label: id, isSimple: false, items: [item] });
                          }
                        }
                      });
                      const renderPalletTable = (title: string, groupData: typeof grouped, isEmptyText: string, isAgrupados: boolean, freePallets?: typeof grouped) => (
                        <div 
                          className={cn("flex flex-col h-[calc(100vh-320px)] min-h-[500px] rounded-3xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-slate-950/50 overflow-hidden transition-colors relative",
                            isAgrupados && dragOverTarget === "LEFT_TABLE_CONTAINER" ? "ring-4 ring-blue-500/50 bg-blue-50/5 dark:bg-blue-900/10" : ""
                          )}
                          onDragOver={(e) => {
                            if (isAgrupados && draggedItem && !draggedItem.id_palete) {
                              e.preventDefault();
                              if (dragOverTarget !== "LEFT_TABLE_CONTAINER") {
                                handleDragOver(e, "LEFT_TABLE_CONTAINER");
                              }
                            }
                          }}
                          onDragLeave={(e) => {
                            if (isAgrupados && dragOverTarget === "LEFT_TABLE_CONTAINER") {
                               handleDragLeave(e);
                            }
                          }}
                          onDrop={(e) => {
                            if (isAgrupados && draggedItem && !draggedItem.id_palete) {
                               e.preventDefault();
                               e.stopPropagation();
                               if (dragOverTarget === "LEFT_TABLE_CONTAINER") {
                                  handleDrop(e, 'new_standalone_mix', null, null);
                               }
                            }
                          }}
                        >
                          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">{title}</h4>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-full">{groupData.length} registros</span>
                          </div>
                          <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
                            {groupData.length === 0 ? (
                              <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-400 dark:text-slate-500 italic p-6 text-center">
                                {isEmptyText}
                              </div>
                            ) : (
                              <table className="w-full min-w-[500px] text-left">
                                <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10">
                                  <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-6"></th>
                                    <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">ID Palete</th>
                                    <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Produto</th>
                                    <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Descrição</th>
                                    <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Qtd</th>
                                    <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Obs</th>
                                    {user && <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center w-8">Ação</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {groupData.map((group, gi) => {
                                    const isExpanded = expandedPallets.has(group.key);
                                    const totalQty = group.items.reduce((s: number, i: any) => s + (Number(i.quantidade_total) || 0), 0);
                                    const isComposite = !group.isSimple;
                                    const singleItem = group.items[0];
                                    return (
                                      <React.Fragment key={group.key}>
                                        <tr 
                                            key={group.key} 
                                            onClick={() => isComposite && togglePallet(group.key)}
                                            onDragOver={(e) => {
                                              if (draggedItem && draggedItem.id !== singleItem?.id && group.label !== draggedItem.id_palete) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleDragOver(e, group.key);
                                              }
                                            }}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => {
                                              if (draggedItem && draggedItem.id !== singleItem?.id && group.label !== draggedItem.id_palete) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (isComposite) {
                                                  handleDrop(e, 'mix', group.label, group);
                                                } else {
                                                  handleDrop(e, 'new_mix', null, singleItem);
                                                }
                                              }
                                            }}
                                            draggable={!isComposite}
                                            onDragStart={!isComposite ? (e: any) => handleDragStart(e, singleItem) : undefined}
                                            onDragEnd={(e: any) => handleDragEnd(e)}
                                            className={cn(
                                              "group transition-all duration-200 relative",
                                              isComposite ? "border-b-2 border-slate-200 dark:border-slate-700/50" : "border-b border-slate-100 dark:border-slate-800",
                                              isComposite ? "cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-500/5" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                                              dragOverTarget === group.key ? "bg-blue-100/50 dark:bg-blue-900/30 ring-2 ring-blue-400 z-10" : "",
                                              draggedItem?.id === singleItem?.id ? "opacity-50" : ""
                                            )}
                                          >
                                          {/* Expand toggle */}
                                          <td className="px-2 py-3 w-6">
                                            {isComposite ? (
                                              <span className={cn("inline-flex items-center justify-center h-5 w-5 rounded-full text-blue-500 bg-blue-50 dark:bg-blue-500/10 transition-transform", isExpanded && "rotate-90")}>
                                                <ChevronRight size={12} strokeWidth={3} />
                                              </span>
                                            ) : null}
                                          </td>
                                          {/* ID Palete */}
                                          <td className="px-3 py-3">
                                            {group.isSimple ? (
                                              <span className="text-[10px] italic text-slate-400">S/ ALOCAÇÃO</span>
                                            ) : (
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-black text-blue-500 dark:text-blue-300 tracking-wide">{group.label}</span>
                                                {isComposite && (
                                                  <span className="text-[8px] font-bold text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">{group.items.length} SKUs</span>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                          {/* Produto */}
                                          <td className="px-3 py-3">
                                            {isComposite ? (
                                              <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">—</span>
                                            ) : (
                                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight">{singleItem.produto || "—"}</span>
                                            )}
                                          </td>
                                          {/* Descrição */}
                                          <td className="px-3 py-3 max-w-[150px]">
                                            {isComposite ? (
                                              <span className="text-[9px] text-slate-400 italic">Palete misto com {group.items.length} itens</span>
                                            ) : (
                                              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase truncate block max-w-[150px]">{singleItem.descricao || "—"}</span>
                                            )}
                                          </td>
                                          {/* Qtd Total */}
                                          <td className="px-3 py-3 text-right">
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-300">{fmtNum(totalQty)}</span>
                                          </td>
                                          {/* Observação */}
                                          <td className="px-3 py-3">
                                            {!isComposite && (() => {
                                              const obs = singleItem.observacao;
                                              const strObs = obs && obs !== 0 ? String(obs) : "-";
                                              const isCrit = strObs.endsWith("!");
                                              return (
                                                <span className={cn("text-[10px] italic truncate block max-w-[100px] px-1.5 py-0.5 rounded w-fit",
                                                  isCrit ? "text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 not-italic" : "text-slate-400"
                                                )}>{strObs}</span>
                                              );
                                            })()}
                                          </td>
                                          {/* Ação */}
                                          {user && (
                                            <td className="px-3 py-3 text-center">
                                              {!isComposite && (
                                                <div className="flex items-center justify-center gap-1">
                                                  {/* Dividir: só aparece quando qty > 1 */}
                                                  {(Number(singleItem.quantidade_total) > 1) && (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSplitTarget(singleItem);
                                                        setSplitQtyPerPallet("");
                                                        setSplitModalOpen(true);
                                                      }}
                                                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                                                      title="Retirar peças"
                                                    >
                                                      <Scissors size={13} />
                                                    </button>
                                                  )}
                                                  {/* Juntar: só aparece quando há mais de 1 linha do mesmo SKU na lista livre */}
                                                  {(() => {
                                                    const sameSku = freePallets
                                                      ? freePallets.filter(g => g.items[0]?.produto === singleItem.produto)
                                                      : [];
                                                    if (sameSku.length > 1) {
                                                      return (
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            const ids = sameSku.map(g => g.items[0].id);
                                                            setMergeTarget({
                                                              sku: singleItem.produto,
                                                              items: sameSku.map(g => g.items[0])
                                                            });
                                                            setSelectedMergeIds(new Set(ids));
                                                            setMergeModalOpen(true);
                                                          }}
                                                          className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                          title="Mover peças"
                                                        >
                                                          <GitMerge size={13} />
                                                        </button>
                                                      );
                                                    }
                                                    return null;
                                                  })()}
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setDeleteTarget(singleItem);
                                                      setDeleteQuantity(String(singleItem.quantidade_total || "0"));
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Excluir"
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                </div>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                        {/* Sub-rows */}
                                        <AnimatePresence>
                                          {isComposite && isExpanded && group.items.map((sub: any, si: number) => (
                                            <motion.tr 
                                                key={sub.id} 
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                                                transition={{ delay: si * 0.04 }}
                                                draggable
                                                onDragStart={(e: any) => handleDragStart(e, sub)}
                                                onDragEnd={(e: any) => handleDragEnd(e)}
                                                className={cn(
                                                  "bg-blue-50/30 dark:bg-blue-500/5 border-b border-blue-100/50 dark:border-blue-500/10 cursor-grab active:cursor-grabbing",
                                                  draggedItem?.id === sub.id ? "opacity-50" : ""
                                                )}
                                              >
                                              <td className="px-2 py-2">
                                                <div className="w-px h-full bg-blue-200 dark:bg-blue-700 mx-auto opacity-50"></div>
                                              </td>
                                              <td className="px-3 py-2">
                                                <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400 pl-2 border-l-2 border-blue-200">╰ sub-item</span>
                                              </td>
                                              <td className="px-3 py-2">
                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{sub.produto || "—"}</span>
                                              </td>
                                              <td className="px-3 py-2 max-w-[150px]">
                                                <span className="text-[9px] text-slate-400 uppercase truncate block max-w-[150px]">{sub.descricao || "—"}</span>
                                              </td>
                                              <td className="px-3 py-2 text-right">
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{fmtNum(sub.quantidade_total)}</span>
                                              </td>
                                              <td className="px-3 py-2">
                                                {(() => {
                                                  const obs = sub.observacao;
                                                  const strObs = obs && obs !== 0 ? String(obs) : "-";
                                                  return <span className="text-[9px] text-slate-400 truncate block max-w-[80px]">{strObs}</span>;
                                                })()}
                                              </td>
                                              {user && (
                                                <td className="px-3 py-2 text-center">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setDeleteTarget(sub);
                                                      setDeleteQuantity(String(sub.quantidade_total || "0"));
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Excluir sub-item"
                                                  >
                                                    <Trash2 size={12} />
                                                  </button>
                                                </td>
                                              )}
                                            </motion.tr>
                                          ))}
                                        </AnimatePresence>
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      );

                      const agrupados = grouped.filter(g => !g.isSimple);
                      const desagrupados = grouped.filter(g => g.isSimple);

                      return (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start w-full">
                          {renderPalletTable("Paletes Agrupados", agrupados, "Nenhum palete agrupado no momento.", true)}
                          {renderPalletTable("Livres (Sem Alocação / Sem Agrupamento)", desagrupados, "Nenhum item livre. Todos estão agrupados ou a lista está vazia.", false, desagrupados)}
                        </div>
                      );
                    })()
                  }
                  {
                    displayMode === "tabela" && (
                      <div className="rounded-3xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-slate-950/50 overflow-x-auto custom-scrollbar transition-colors">
                        <div className="min-w-[800px] lg:min-w-full">
                          <WarehouseTable
                            columns={getColumns()}
                            data={paginatedData}
                            delay={0.1}
                            onRowClick={(row) => {
                              if (activeView === "produtos") {
                                setModalFilter(false)
                                setSelectedProduct(row.produto)
                              }
                              if (activeView === "molhados") {
                                setModalFilter(true)
                                setSelectedProduct(row.produto)
                              }
                            }}
                            selectable={false}
                            selectedIds={selectedNaoAlocados}
                            onSelectionChange={setSelectedNaoAlocados}
                            idAccessor="id"
                            sortConfig={tableSort}
                            onSort={handleSort}
                          />
                        </div>
                      </div>
                    )
                  }

                  {/* Pagination for table within mapeamento */}
                  {
                    (displayMode === "tabela" || displayMode === "nao_alocados") && totalPages >= 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 pb-12 transition-colors">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest order-2 sm:order-1">
                          {rowsPerPage === 'ALL' ? `Exibindo todos os ${filteredData.length} itens` : `Página ${currentPage} de ${totalPages}`}
                        </span>
                        <div className="flex gap-3 order-1 sm:order-2 items-center">
                          {user && (
                            <button
                              onClick={() => setIsAddItemModalOpen(true)}
                              className="px-4 py-2 sm:px-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 whitespace-nowrap"
                            >
                              <Plus size={14} />
                              <span>Adicionar Item</span>
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setRowsPerPage(prev => prev === 'ALL' ? 10 : 'ALL')
                              setCurrentPage(1)
                            }}
                            className="px-4 py-2 sm:px-3 sm:py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          >
                            {rowsPerPage === 'ALL' ? "Voltar ao padrão" : "Ver todos"}
                          </button>
                          {rowsPerPage !== 'ALL' && (
                            <>
                              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95 transition-colors"><ChevronLeft size={18} /></button>
                              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95 transition-colors"><ChevronRight size={18} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  }

                  {
                    (globalStats?.pendencias?.length ?? 0) > 0 && (
                      <div className="mt-12 mb-8">
                        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-3xl p-6 shadow-sm overflow-hidden relative">
                          <div className="absolute -top-10 -right-10 text-amber-500/5 rotate-12 pointer-events-none">
                            <Package size={200} />
                          </div>

                          <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                              <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
                                <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
                              </div>
                              <div>
                                <h3 className="text-lg font-black text-amber-900 dark:text-amber-300">Janela de Pendências</h3>
                                <p className="text-[10px] uppercase font-bold text-amber-700/60 dark:text-amber-400/60 tracking-wider">Produtos no Registro sem Mapeamento Físico Completo</p>
                              </div>
                            </div>
                            <div className="px-3 py-1 bg-white/60 dark:bg-slate-900/60 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 backdrop-blur-sm shadow-sm">
                              {globalStats.pendencias.length} {globalStats.pendencias.length === 1 ? 'Código com Pendência' : 'Códigos com Pendência'}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative z-10">
                            {globalStats.pendencias.map((div: any) => (
                              <div key={div.sku} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-amber-100 dark:border-amber-500/10 flex flex-col gap-3 transition-transform hover:scale-[1.02] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-amber-300 dark:hover:border-amber-500/30">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">{div.sku}</span>
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                                    {div.diff.toLocaleString('pt-BR')} UN
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                                  <div className="flex flex-col p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <span className="text-[9px] uppercase tracking-wider font-bold mb-1">Mapeado</span>
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-300">{div.mapQty.toLocaleString('pt-BR')} <span className="text-[10px] font-medium text-slate-400">UN</span></span>
                                  </div>
                                  <div className="flex flex-col text-right p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <span className="text-[9px] uppercase tracking-wider font-bold mb-1 text-slate-400">Registrado</span>
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-300">{div.regQty.toLocaleString('pt-BR')} <span className="text-[10px] font-medium text-slate-400">UN</span></span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  }
                </motion.div >

              )}

              {topTab === "registros" && !!user && (
                <motion.div
                  key="registros-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1 overflow-hidden"
                >
                  <RegistrosTab onRefresh={fetchData} />
                </motion.div>
              )}

              {topTab === "confrontos" && (
                <motion.div
                  key="confrontos-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {loadingConfrontos && !confrontosData ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-6">
                      <div className="relative">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                          className="h-16 w-16 rounded-full border-2 border-blue-500/20 border-t-blue-500"
                        />
                        <motion.div
                          initial={{ opacity: 0.5, scale: 0.8 }}
                          animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.1, 0.8] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <GitCompare size={24} className="text-blue-500" />
                        </motion.div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Sincronizando Confrontos</p>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium">Isso pode levar alguns segundos dependendo da base...</p>
                      </div>
                    </div>
                  ) : errorConfrontos ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
                      <div className="h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500">
                        <RefreshCw size={28} />
                      </div>
                      <div className="text-center">
                        <h4 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{errorConfrontos}</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-[280px]">Verifique sua conexão com o servidor ou tente novamente em alguns instantes.</p>
                      </div>
                      <button
                        onClick={() => fetchConfrontos()}
                        className="group flex items-center gap-3 px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none"
                      >
                        <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                        Tentar Novamente
                      </button>
                    </div>
                  ) : confrontosData ? (
                    <div className={cn("transition-opacity duration-300 relative", loadingConfrontos && "opacity-50 pointer-events-none")}>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={confrontoType}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-6"
                        >
                          {/* Painel Premium Minimalista */}
                          {(() => {
                            const divergenciasAjustadas = confrontosData.dados.filter((c: any) => {
                              const skuNormal = normalizeSku(c.produto);
                              const itemAdjustments = confrontoType === "fisico_x_a501" ? ajustesConfronto.filter((a: any) => normalizeSku(a.produto) === skuNormal) : [];
                              const ajusteSoma = itemAdjustments.reduce((acc, curr) => acc + curr.quantidade, 0);
                              const qtdFisicaAjustada = c.qtd_fisica + ajusteSoma
                              return Math.abs(qtdFisicaAjustada - c.qtd_sistema) > 0.001;
                            }).length;
                            const total = confrontosData.total_produtos;
                            const acuracidade = Math.round(((total - divergenciasAjustadas) / Math.max(1, total)) * 100);

                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Tag className="text-slate-500" size={14} />
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">PRODUTOS ANALISADOS</p>
                                  </div>
                                  <p className="text-3xl font-light text-slate-900 dark:text-slate-100">{total}</p>
                                </div>
                                <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="text-slate-500" size={14} />
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">DIVERGÊNCIAS ENCONTRADAS</p>
                                  </div>
                                  <p className="text-3xl font-light text-slate-900 dark:text-slate-100">{divergenciasAjustadas}</p>
                                </div>
                                <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                                  <div className="flex items-center gap-2 mb-2">
                                    <BarChart3 className="text-slate-500" size={14} />
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">ÍNDICE DE ACURACIDADE</p>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <p className="text-3xl font-light text-slate-900 dark:text-slate-100">{acuracidade}%</p>
                                    <div className="w-full bg-slate-200/80 dark:bg-slate-800/80 rounded-full h-1 mt-1 overflow-hidden flex">
                                      <div className="bg-emerald-500 h-1 rounded-full transition-all duration-1000" style={{ width: `${acuracidade}%` }}></div>
                                    </div>
                                  </div>
                                </div>
                                <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Layers className="text-slate-500" size={14} />
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">SALDO LÍQUIDO DE PEÇAS</p>
                                  </div>
                                  <div className="flex items-baseline gap-2">
                                    {(() => {
                                      const fisico = confrontosData.dados.reduce((acc: number, item: any) => {
                                        const skuNormal = normalizeSku(item.produto);
                                        const itemAdjustments = confrontoType === "fisico_x_a501" ? ajustesConfronto.filter(a => normalizeSku(a.produto) === skuNormal) : [];
                                        const ajusteSoma = itemAdjustments.reduce((a, c) => a + c.quantidade, 0);
                                        return acc + (item.qtd_fisica + ajusteSoma)
                                      }, 0);

                                      const sistema = confrontosData.dados.reduce((acc: number, item: any) => acc + item.qtd_sistema, 0);
                                      const net = fisico - sistema;
                                      return (
                                        <>
                                          <p className={cn("text-3xl font-light", net > 0 ? "text-emerald-600 dark:text-emerald-400" : net < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100")}>
                                            {net > 0 ? "+" : ""}{fmtNum(net)}
                                          </p>
                                          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                                            ({confrontoType === "fisico_x_a501" ? "FÍS." : "A501"} {fmtNum(fisico)} / {confrontoType === "fisico_x_a501" ? "SIST." : "G501"} {fmtNum(sistema)})
                                          </p>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Filtros e Busca Funcionais Estilo UI Premium */}
                          {(() => {
                            const counts = confrontosData.dados.reduce((acc: any, c: any) => {
                              const skuNormal = normalizeSku(c.produto);
                              const ajusteSoma = confrontoType === "fisico_x_a501" ? ajustesConfronto.filter(a => normalizeSku(a.produto) === skuNormal).reduce((x, curr) => x + curr.quantidade, 0) : 0
                              const qtdFisicaAjustada = c.qtd_fisica + ajusteSoma
                              const diferenca = qtdFisicaAjustada - c.qtd_sistema

                              acc.all++
                              if (ajusteSoma !== 0) acc.adjusted++
                              if (diferenca === 0) {
                                acc.match++
                              } else {
                                acc.divergent++
                                if (diferenca > 0) acc.excess++
                                else acc.missing++
                              }
                              return acc
                            }, { all: 0, divergent: 0, excess: 0, missing: 0, match: 0, adjusted: 0 })

                            return (
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                                <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-[1.25rem] shadow-inner backdrop-blur-sm">
                                  <button
                                    onClick={() => setConfrontoFilter("all")}
                                    className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "all" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                                  >
                                    Tudo <span className="opacity-70 text-[10px] font-black bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.all}</span>
                                  </button>
                                  <button
                                    onClick={() => setConfrontoFilter("divergent")}
                                    className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "divergent" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                                  >
                                    Divergentes <span className="opacity-70 text-[10px] font-black bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.divergent}</span>
                                  </button>
                                  <button
                                    onClick={() => setConfrontoFilter("excess")}
                                    className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "excess" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                                  >
                                    Sobras <span className="opacity-70 text-[10px] font-black bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.excess}</span>
                                  </button>
                                  <button
                                    onClick={() => setConfrontoFilter("missing")}
                                    className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "missing" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                                  >
                                    Faltas <span className="opacity-70 text-[10px] font-black bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.missing}</span>
                                  </button>
                                  <button
                                    onClick={() => setConfrontoFilter("match")}
                                    className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "match" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                                  >
                                    Batendo <span className="opacity-70 text-[10px] font-black bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.match}</span>
                                  </button>
                                  {confrontoType === "fisico_x_a501" && (
                                    <button
                                      onClick={() => setConfrontoFilter("adjusted")}
                                      className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "adjusted" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30 font-black")}
                                    >
                                      Ajustados <span className="opacity-70 text-[10px] font-black bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md">{counts.adjusted}</span>
                                    </button>
                                  )}
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                  <div className="relative flex-1 sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                    <input
                                      type="text"
                                      placeholder="Buscar produto ou desc..."
                                      value={confrontoSearch}
                                      onChange={(e) => setConfrontoSearch(e.target.value)}
                                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors"
                                    />
                                  </div>
                                  <button
                                    onClick={() => setConfrontoSortDir(d => d === "asc" ? "desc" : "asc")}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="Ordenar por Diferença"
                                  >
                                    <ArrowDownAZ size={14} className={cn("transition-transform duration-300", confrontoSortDir === "desc" && "rotate-180")} />
                                    <span className="hidden sm:inline">Ordenar</span>
                                  </button>
                                  <button
                                    onClick={() => setModalAjusteOpen(true)}
                                    className={cn(
                                      "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm bg-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600/20 hover:border-blue-500/50 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]"
                                    )}
                                    title="Ajuste Manual de Divergências"
                                  >
                                    <Settings size={14} className={ajustesConfronto.length > 0 ? "animate-spin-slow" : ""} />
                                    <span className="hidden sm:inline">
                                      Ajustes {ajustesConfronto.length > 0 ? `(${ajustesConfronto.length})` : ''}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Tabela Clean, com visual glassmorphism, leveza nas fontes */}
                          <div className="border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm rounded-2xl overflow-hidden shadow-xl">
                            <table className="w-full text-left min-w-[700px]">
                              <thead className="bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">Código</th>
                                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">Descrição</th>
                                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-right transition-colors">{confrontoType === "fisico_x_a501" ? "Física" : "Sist. A501"}</th>
                                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-right transition-colors">{confrontoType === "fisico_x_a501" ? "Sistema" : "Sist. G501"}</th>
                                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-right transition-colors">Saldo</th>
                                </tr>
                              </thead>
                              <AnimatePresence mode="wait">
                                <motion.tbody
                                  key={`${confrontoType}-${confrontoFilter}-${confrontoSearch}-${confrontoSortDir}`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  transition={{ duration: 0.2 }}
                                  className="divide-y divide-slate-200 dark:divide-slate-800/50"
                                >
                                  {(() => {
                                    const dadosAjustados = confrontosData.dados.map((c: any) => {
                                      const skuNormal = normalizeSku(c.produto);
                                      const itemAdjustments = confrontoType === "fisico_x_a501" ? ajustesConfronto.filter((a: any) => normalizeSku(a.produto) === skuNormal) : [];
                                      const ajusteSoma = itemAdjustments.reduce((acc, curr) => acc + curr.quantidade, 0);
                                      const qtdFisicaAjustada = c.qtd_fisica + ajusteSoma;
                                      const diferencaAjustada = qtdFisicaAjustada - c.qtd_sistema
                                      return {
                                        ...c,
                                        qtd_fisica_original: c.qtd_fisica,
                                        qtd_fisica: qtdFisicaAjustada,
                                        diferenca: diferencaAjustada,
                                        teve_ajuste: ajusteSoma !== 0,
                                        ajuste_quantidade: ajusteSoma,
                                        motivo_ajuste: itemAdjustments.map(a => a.motivo).join('; ')
                                      }
                                    });

                                    const filtered = dadosAjustados.filter((c: any) => {
                                      // Filtros de Tabs
                                      if (confrontoFilter === "divergent" && c.diferenca === 0) return false;
                                      if (confrontoFilter === "match" && c.diferenca !== 0) return false;
                                      if (confrontoFilter === "excess" && c.diferenca <= 0) return false;
                                      if (confrontoFilter === "missing" && c.diferenca >= 0) return false;
                                      if (confrontoFilter === "adjusted" && !c.teve_ajuste) return false;

                                      // Filtro da Busca
                                      if (confrontoSearch) {
                                        const term = confrontoSearch.toLowerCase();
                                        const p = String(c.produto || "").toLowerCase();
                                        const d = String(c.descricao || "").toLowerCase();
                                        if (!p.includes(term) && !d.includes(term)) {
                                          return false;
                                        }
                                      }
                                      return true;
                                    });

                                    // Ordenação
                                    filtered.sort((a: any, b: any) => {
                                      if (confrontoSortDir === "asc") {
                                        return a.diferenca - b.diferenca;
                                      } else {
                                        return b.diferenca - a.diferenca;
                                      }
                                    });

                                    if (filtered.length === 0) {
                                      return (
                                        <tr>
                                          <td colSpan={5} className="px-5 py-16 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Nenhum registro encontrado.
                                          </td>
                                        </tr>
                                      )
                                    }

                                    const startIndex = (confrontoCurrentPage - 1) * confrontoItemsPerPage;
                                    const endIndex = startIndex + confrontoItemsPerPage;
                                    const paginatedFiltered = filtered.slice(startIndex, endIndex);

                                    return paginatedFiltered.map((c: any, i: number) => (
                                      <tr key={i} onClick={() => setSelectedConfrontoItem(c)} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all hover:scale-[1.01] hover:shadow-lg group cursor-pointer relative z-0 hover:z-10">
                                        <td className="px-5 py-3.5">
                                          <span className="text-sm font-normal text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{c.produto}</span>
                                          {c.teve_ajuste && (
                                            <span className="ml-2 inline-flex border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-bold px-1.5 py-0.5 rounded-md align-middle shadow-sm" title={c.motivo_ajuste}>
                                              AJUSTADO
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                          <p className="text-xs font-normal text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors truncate max-w-[250px]">{c.descricao}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                          <div className="flex flex-col items-end">
                                            <span className={cn("text-sm font-normal", c.teve_ajuste ? "text-blue-600 dark:text-blue-300 font-bold" : "text-slate-600 dark:text-slate-300")}>{fmtNum(c.qtd_fisica)}</span>
                                            {c.teve_ajuste && (
                                              <span className="text-[9px] text-slate-400 dark:text-slate-500 line-through">Orig: {fmtNum(c.qtd_fisica_original)}</span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                          <span className="text-sm font-normal text-slate-600 dark:text-slate-300">{fmtNum(c.qtd_sistema)}</span>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                          {c.diferenca === 0 ? (
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Bateu</span>
                                          ) : (
                                            <span className={cn("text-xs font-bold", c.diferenca > 0 ? "text-amber-500 dark:text-amber-400" : "text-rose-600 dark:text-rose-400")}>
                                              {c.diferenca > 0 ? "+" : ""}{c.diferenca} {c.diferenca > 0 ? "(Positivado)" : "(Negativo)"}
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))
                                  })()
                                  }
                                </motion.tbody>
                              </AnimatePresence>
                            </table>
                          </div>

                          {/* Confrontos Pagination */}
                          {(() => {
                            const dadosAjustados = confrontosData.dados.map((c: any) => {
                              const skuNormal = normalizeSku(c.produto);
                              const itemAdjustments = confrontoType === "fisico_x_a501" ? ajustesConfronto.filter((a: any) => normalizeSku(a.produto) === skuNormal) : [];
                              const ajusteSoma = itemAdjustments.reduce((acc, curr) => acc + curr.quantidade, 0);
                              const qtdFisicaAjustada = c.qtd_fisica + ajusteSoma
                              return {
                                ...c,
                                teve_ajuste: ajusteSoma !== 0,
                                diferenca: qtdFisicaAjustada - c.qtd_sistema
                              }
                            });

                            const filtered = dadosAjustados.filter((c: any) => {
                              if (confrontoFilter === "divergent" && c.diferenca === 0) return false;
                              if (confrontoFilter === "match" && c.diferenca !== 0) return false;
                              if (confrontoFilter === "excess" && c.diferenca <= 0) return false;
                              if (confrontoFilter === "missing" && c.diferenca >= 0) return false;
                              if (confrontoFilter === "adjusted" && !c.teve_ajuste) return false;
                              if (confrontoSearch) {
                                const term = confrontoSearch.toLowerCase();
                                if (!c.produto.toLowerCase().includes(term) && !c.descricao.toLowerCase().includes(term)) return false;
                              }
                              return true;
                            });

                            const confTotalPages = Math.ceil(filtered.length / confrontoItemsPerPage);
                            if (confTotalPages <= 1) return null;

                            const startIndex = (confrontoCurrentPage - 1) * confrontoItemsPerPage;
                            const endIndex = Math.min(startIndex + confrontoItemsPerPage, filtered.length);

                            return (
                              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-b-[2.5rem]">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                  Mostrando {startIndex + 1}-{endIndex} de {filtered.length} resultados
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setConfrontoCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={confrontoCurrentPage === 1}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <ChevronLeft size={16} />
                                  </button>
                                  {[...Array(confTotalPages)].map((_, idx) => {
                                    const page = idx + 1;
                                    // simple pagination logic to show limited pages
                                    if (
                                      page === 1 ||
                                      page === confTotalPages ||
                                      (page >= confrontoCurrentPage - 1 && page <= confrontoCurrentPage + 1)
                                    ) {
                                      return (
                                        <button
                                          key={page}
                                          onClick={() => setConfrontoCurrentPage(page)}
                                          className={cn(
                                            "h-8 min-w-[2rem] px-2 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                                            confrontoCurrentPage === page
                                              ? "bg-[#1E3A8A] dark:bg-blue-600 text-white shadow-sm"
                                              : "text-[#1E3A8A] dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800"
                                          )}
                                        >
                                          {page}
                                        </button>
                                      );
                                    }
                                    if (
                                      page === confrontoCurrentPage - 2 ||
                                      page === confrontoCurrentPage + 2
                                    ) {
                                      return <span key={page} className="px-1 text-slate-400">...</span>;
                                    }
                                    return null;
                                  })}
                                  <button
                                    onClick={() => setConfrontoCurrentPage(p => Math.min(confTotalPages, p + 1))}
                                    disabled={confrontoCurrentPage === confTotalPages}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                        </motion.div>
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-32 space-y-6">
                      <div className="relative">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                          className="h-16 w-16 rounded-full border-2 border-blue-500/20 border-t-blue-500"
                        />
                        <motion.div
                          initial={{ opacity: 0.5, scale: 0.8 }}
                          animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.1, 0.8] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <GitCompare size={24} className="text-blue-500" />
                        </motion.div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Aguardando Dados...</p>
                      </div>
                    </div>
                  )}

                  {/* Modal de Lançamento de Ajustes de Saldo */}
                  <AnimatePresence>
                    {modalAjusteOpen && (
                      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalAjusteOpen(false)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">

                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
                              <Settings size={20} className="text-blue-600 dark:text-blue-500" />
                              Lançar Ajuste Manual
                            </h3>
                            <button onClick={() => setModalAjusteOpen(false)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                              <X size={20} />
                            </button>
                          </div>

                          {user ? (
                            <form onSubmit={async (e) => {
                              e.preventDefault();
                              const formData = new FormData(e.currentTarget);
                              const prod = (formData.get('produto') as string).trim().toUpperCase();
                              const qtd = Math.floor(Number(formData.get('quantidade')));
                              const motivo = (formData.get('motivo') as string).trim();

                              if (!prod || isNaN(qtd) || !motivo) return;

                              try {
                                // 1. Persistir no Supabase primeiro
                                const { data, error } = await supabase
                                  .from('Ajuste')
                                  .insert({
                                    'Código': prod,
                                    'Quantidade': qtd,
                                    'Motivo': motivo,
                                    'Data': new Date().toISOString().split('T')[0]
                                  })
                                  .select()

                                if (error) throw error;

                                if (data?.[0]) {
                                  // 2. Adicionar ao estado local com o ID real
                                  const novoAjuste: AjusteManal = {
                                    id: data[0].id,
                                    produto: prod,
                                    quantidade: qtd,
                                    motivo,
                                    usuario: user.email || "Usuário",
                                    timestamp: new Date()
                                  };
                                  setAjustesConfronto(prev => [novoAjuste, ...prev]);
                                  (e.target as HTMLFormElement).reset();
                                }
                              } catch (err: any) {
                                console.error("Erro ao salvar ajuste:", err);
                                alert("Erro ao salvar no banco de dados: " + err.message);
                              }
                            }} className="space-y-4 mb-8">

                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Código do Produto (SKU)</label>
                                <input required name="produto" type="text" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" placeholder="Ex: 1024-00" />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">QTD de Ajuste (+ ou -)</label>
                                <input
                                  required
                                  name="quantidade"
                                  type="number"
                                  step="1"
                                  onInput={(e) => {
                                    const val = (e.target as HTMLInputElement).value;
                                    if (val.includes('.') || val.includes(',')) {
                                      (e.target as HTMLInputElement).value = val.split(/[.,]/)[0];
                                    }
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                                  placeholder="Ex: -5 ou 10"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Motivo do Ajuste</label>
                                <textarea required name="motivo" rows={2} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 resize-none" placeholder="Ex: Contagem dupla na Doca 3..." />
                              </div>

                              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20">
                                Aplicar Ajuste Permanente
                              </button>
                            </form>
                          ) : (
                            <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                              <p className="text-sm text-slate-600 dark:text-slate-300">Faça <span className="text-blue-600 dark:text-blue-400 font-bold cursor-pointer" onClick={() => { setModalAjusteOpen(false); setShowLoginModal(true); }}>login</span> para lançar novos ajustes. Visitantes podem apenas visualizar o histórico abaixo.</p>
                            </div>
                          )}

                          <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Histórico de Ajustes ({ajustesConfronto.length})</h4>
                              {ajustesConfronto.length > 0 && (
                                <button onClick={async () => {
                                  if (!user) {
                                    setShowLoginModal(true)
                                    return
                                  }
                                  if (confirm("Deseja realmente remover TODOS os ajustes permanentes do banco de dados?")) {
                                    const { error } = await supabase
                                      .from('Ajuste')
                                      .delete()
                                      .neq('id', 0) // Delete all

                                    if (error) {
                                      alert("Erro ao limpar banco: " + error.message)
                                    } else {
                                      setAjustesConfronto([])
                                    }
                                  }
                                }} className={cn(
                                  "text-[10px] font-bold uppercase tracking-widest transition-colors",
                                  user ? "text-rose-500 hover:text-rose-400" : "text-slate-400"
                                )}>
                                  {user ? "Remover Todos" : "Login para Limpar"}
                                </button>
                              )}
                            </div>

                            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                              {ajustesConfronto.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-600 text-center py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">Nenhum ajuste ativo.</p>
                              ) : (
                                ajustesConfronto.map((aj, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 p-3 rounded-xl gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{aj.produto}</span>
                                        <span className={cn("text-xs font-black", aj.quantidade > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{aj.quantidade > 0 ? "+" : ""}{aj.quantidade}</span>
                                        {aj.timestamp && (
                                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium ml-auto">
                                            {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(aj.timestamp))}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-slate-500 truncate" title={aj.motivo}>{aj.motivo}</p>
                                    </div>
                                    <button onClick={async () => {
                                      if (!user) {
                                        setShowLoginModal(true)
                                        return
                                      }
                                      if (!confirm(`Deseja remover o ajuste de ${aj.quantidade > 0 ? "+" : ""}${aj.quantidade} do SKU ${aj.produto}?`)) {
                                        return;
                                      }

                                      setAjustesConfronto(prev => prev.filter(p => p.id !== aj.id))
                                      if (aj.id) {
                                        const { error } = await supabase
                                          .from('Ajuste')
                                          .delete()
                                          .eq('id', aj.id)
                                        if (error) console.error("Erro ao deletar no Supabase:", error)
                                      }
                                    }} className={cn(
                                      "flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors border",
                                      user
                                        ? "bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border-transparent hover:border-rose-200 dark:hover:border-rose-500/30"
                                        : "bg-slate-100 dark:bg-slate-900 text-slate-300 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                                    )}>
                                      {user ? <X size={14} /> : <Lock size={12} />}
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                </motion.div>
              )
              }
            </AnimatePresence >
          </div >

          {/* Modal de Importação em Massa A501 */}
          <AnimatePresence>
            {modalImportA501Open && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalImportA501Open(false)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm" />
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <PlusSquare size={20} className="text-blue-600" />
                      Importar Dados A501 (Sistema)
                    </h3>
                    <button onClick={() => setModalImportA501Open(false)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {!user ? (
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Você precisa estar logado para atualizar a base de dados do sistema.</p>
                      <button onClick={() => { setModalImportA501Open(false); setShowLoginModal(true); }} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider">Fazer Login</button>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 gap-6">
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Cole os dados do Excel/Sheets abaixo. Ordem esperada: <span className="font-bold text-slate-700 dark:text-slate-200">Código | Descrição | Quantidade</span> (separadas por TAB).</p>
                        <div className="relative flex-1 min-h-[300px]">
                          <textarea
                            value={importTextA501}
                            onChange={(e) => setImportTextA501(e.target.value)}
                            className="w-full h-full min-h-[300px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4 text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto custom-scrollbar"
                            placeholder="Ex:&#10;1024-00	CABO USB TIPO C	150&#10;2050-X	CARREGADOR TURBO	42"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
                        <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
                          <span className="font-black uppercase">Atenção:</span> Esta operação irá <span className="font-black underline italic">APAGAR TODOS</span> os registros atuais da tabela A501 no Supabase e substituí-los pelo conteúdo acima.
                        </p>
                      </div>

                      <button
                        disabled={isImportingA501 || !importTextA501.trim()}
                        onClick={async () => {
                          let lines = importTextA501.trim().split('\n').filter(l => l.trim());
                          if (lines.length === 0) return;

                          const firstLineLower = lines[0].toLowerCase();
                          if (firstLineLower.includes("código") || firstLineLower.includes("codigo") || firstLineLower.includes("descrição") || firstLineLower.includes("descricao")) {
                            lines = lines.slice(1);
                          }

                          if (lines.length === 0) {
                            alert("Nenhum dado válido encontrado.");
                            return;
                          }

                          if (!confirm(`Confirmar importação de ${lines.length} itens? Isso substituirá a base A501 atual.`)) return;

                          setIsImportingA501(true);
                          try {
                            const dataToInsert = lines.map(line => {
                              const cols = line.split('\t');
                              let rawQty = String(cols[2] || '0').trim();
                              const cleanQty = rawQty.split('.').join('').replace(',', '.');
                              return {
                                'Produto': String(cols[0] || '').trim().toUpperCase(),
                                'Descrição': String(cols[1] || '-').trim(),
                                'Quantidade': Number(cleanQty) || 0
                              };
                            });

                            const { error: delErr } = await supabase.from('A501').delete().neq('Produto', 'xyz_placeholder');
                            if (delErr) throw delErr;

                            const chunkSize = 200;
                            for (let i = 0; i < dataToInsert.length; i += chunkSize) {
                              const chunk = dataToInsert.slice(i, i + chunkSize);
                              const { error: insErr } = await supabase.from('A501').insert(chunk);
                              if (insErr) throw insErr;
                            }

                            alert("Importação concluída com sucesso!");
                            setImportTextA501("");
                            setModalImportA501Open(false);
                            fetchConfrontos();
                          } catch (err: any) {
                            console.error("Erro na importação:", err);
                            alert("Falha ao importar: " + err.message);
                          } finally {
                            setIsImportingA501(false);
                          }
                        }}
                        className={cn(
                          "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                          isImportingA501
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-wait"
                            : "bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                        )}
                      >
                        {isImportingA501 ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-4 w-4 border-2 border-slate-400 border-t-white rounded-full" />
                            Processando...
                          </>
                        ) : "Confirmar e Sobrescrever Base A501"}
                      </button>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Modal de Importação em Massa G501 */}
          <AnimatePresence>
            {modalImportG501Open && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalImportG501Open(false)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm" />
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <PlusSquare size={20} className="text-blue-600" />
                      Importar Dados G501 (Vistoria)
                    </h3>
                    <button onClick={() => setModalImportG501Open(false)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {!user ? (
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Você precisa estar logado para atualizar a base de dados G501.</p>
                      <button onClick={() => { setModalImportG501Open(false); setShowLoginModal(true); }} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider">Fazer Login</button>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 gap-6">
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Cole os dados do Excel/Sheets abaixo. Ordem esperada: <span className="font-bold text-slate-700 dark:text-slate-200">Código | Descrição | Quantidade</span> (separadas por TAB).</p>
                        <div className="relative flex-1 min-h-[300px]">
                          <textarea
                            value={importTextG501}
                            onChange={(e) => setImportTextG501(e.target.value)}
                            className="w-full h-full min-h-[300px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4 text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto custom-scrollbar"
                            placeholder="Ex:&#10;1024-00	CABO USB TIPO C	150&#10;2050-X	CARREGADOR TURBO	42"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
                        <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
                          <span className="font-black uppercase">Atenção:</span> Esta operação irá <span className="font-black underline italic">APAGAR TODOS</span> os registros atuais da tabela G501 no Supabase e substituí-los pelo conteúdo acima.
                        </p>
                      </div>

                      <button
                        disabled={isImportingG501 || !importTextG501.trim()}
                        onClick={async () => {
                          let lines = importTextG501.trim().split('\n').filter(l => l.trim());
                          if (lines.length === 0) return;

                          const firstLineLower = lines[0].toLowerCase();
                          if (firstLineLower.includes("código") || firstLineLower.includes("codigo") || firstLineLower.includes("descrição") || firstLineLower.includes("descricao")) {
                            lines = lines.slice(1);
                          }

                          if (lines.length === 0) {
                            alert("Nenhum dado válido encontrado.");
                            return;
                          }

                          if (!confirm(`Confirmar importação de ${lines.length} itens? Isso substituirá a base G501 atual.`)) return;

                          setIsImportingG501(true);
                          try {
                            const dataToInsert = lines.map(line => {
                              const cols = line.split('\t');
                              let rawQty = String(cols[2] || '0').trim();
                              const cleanQty = rawQty.split('.').join('').replace(',', '.');
                              return {
                                'Produto': String(cols[0] || '').trim().toUpperCase(),
                                'Descrição': String(cols[1] || '-').trim(),
                                'Quantidade': Number(cleanQty) || 0
                              };
                            });

                            const { error: delErr } = await supabase.from('G501').delete().neq('Produto', 'xyz_placeholder');
                            if (delErr) throw delErr;

                            const chunkSize = 200;
                            for (let i = 0; i < dataToInsert.length; i += chunkSize) {
                              const chunk = dataToInsert.slice(i, i + chunkSize);
                              const { error: insErr } = await supabase.from('G501').insert(chunk);
                              if (insErr) throw insErr;
                            }

                            alert("Importação de G501 concluída com sucesso!");
                            setImportTextG501("");
                            setModalImportG501Open(false);
                            fetchConfrontos();
                          } catch (err: any) {
                            console.error("Erro na importação G501:", err);
                            alert("Falha ao importar: " + err.message);
                          } finally {
                            setIsImportingG501(false);
                          }
                        }}
                        className={cn(
                          "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                          isImportingG501
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-wait"
                            : "bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                        )}
                      >
                        {isImportingG501 ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-4 w-4 border-2 border-slate-400 border-t-white rounded-full" />
                            Processando...
                          </>
                        ) : "Confirmar e Sobrescrever Base G501"}
                      </button>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* --- DRILL-DOWN MODAL --- */}
          <AnimatePresence>
            {
              selectedProduct && productDetail && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 transition-colors">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProduct(null)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md" />
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl md:rounded-[3rem] bg-white dark:bg-slate-900 p-5 md:p-10 shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col overflow-hidden transition-colors">
                    <div className="flex items-center justify-between mb-6 md:mb-8">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={cn(
                          "h-10 w-10 md:h-14 md:w-14 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-xl transition-all",
                          modalFilter ? "bg-blue-600 shadow-blue-200 dark:shadow-blue-900/20" : "bg-emerald-600 shadow-emerald-200 dark:shadow-emerald-900/20"
                        )}>
                          {modalFilter ? <Droplet size={20} className="md:w-6 md:h-6" /> : <Tag size={20} className="md:w-6 md:h-6" />}
                        </div>
                        <div className="flex flex-col">
                          <h3 className="text-lg md:text-3xl font-black text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-xs">{selectedProduct}</h3>
                          {productDetail.descricao && productDetail.descricao !== "-" && (
                            <p className="text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate max-w-[300px]">
                              {productDetail.descricao}
                            </p>
                          )}
                          <p className="text-[8px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 md:mt-1">
                            {Math.round(productDetail.total_paletes)} Paletes â€¢ {Math.round(productDetail.total_quantidade).toLocaleString('pt-BR')} Peças
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedProduct(null)} className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"><X size={20} className="md:w-6 md:h-6" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                      <div className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 transition-colors">
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm">
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Posição</th>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Nível</th>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Prof.</th>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Qtd Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {productDetail.positions.map((p, idx) => (
                              <tr key={`${p.posicao}-${idx}`} className="group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                <td className="px-6 py-5 text-left">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <MapPin size={12} />
                                      </div>
                                      <span className="text-sm font-black text-slate-800 dark:text-slate-100">{p.posicao}</span>
                                    </div>
                                    <div className="flex items-center gap-2 pl-9">
                                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase">{fmtNum(p.paletes)} PTs</span>
                                      {p.qtd_molhado > 0 && <span className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase">| {fmtNum(p.qtd_molhado)} M</span>}
                                      {p.qtd_tombada > 0 && <span className="text-[9px] font-black text-red-500 dark:text-red-400 uppercase">| {fmtNum(p.qtd_tombada)} T</span>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-center">
                                  <span className="inline-flex h-7 items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-3 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase">
                                    {p.nivel}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-center">
                                  <span className="text-xs font-black text-slate-500 dark:text-slate-400 transition-colors">{p.profundidade}</span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 transition-colors">{Math.round(p.quantidade).toLocaleString('pt-BR')}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="mt-8 flex justify-end">
                      <button
                        onClick={() => {
                          setTopTab("mapeamento") // Fix: Switch to Map tab
                          setDisplayMode("mapa")
                          setSearch(selectedProduct)
                          setSelectedProduct(null)
                        }}
                        className="group flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-100 dark:shadow-none"
                      >
                        Ver Localizações no Mapa
                        <motion.div
                          animate={{ x: [0, 4, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <ExternalLink size={14} />
                        </motion.div>
                      </button>
                    </div>
                  </motion.div>
                </div>
              )
            }
          </AnimatePresence >

          <AnimatePresence>
            {selectedPalletId && palletDetail && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 transition-colors">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPalletId(null)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md" />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl md:rounded-[3rem] bg-white dark:bg-slate-900 p-5 md:p-10 shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col overflow-hidden transition-colors">
                  <div className="flex items-center justify-between mb-6 md:mb-8">
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="h-14 w-14 md:h-20 md:w-20 rounded-[2rem] bg-orange-600 flex items-center justify-center text-white shadow-2xl shadow-orange-200 dark:shadow-orange-900/20 transition-all">
                        <Layers size={28} className="md:w-10 md:h-10" />
                      </div>
                      <div>
                        <h3 className="text-2xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter transition-colors">Palete {selectedPalletId}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                          <div className="flex items-center gap-1.5 transition-colors">
                            <Package size={12} className="text-slate-400 dark:text-slate-500" />
                            <p className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{fmtNum(palletDetail.total_qty)} Peças</p>
                          </div>
                          <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                          <div className="flex items-center gap-1.5 transition-colors">
                            <MapPin size={12} className="text-orange-500" />
                            <p className="text-[10px] md:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">
                              {palletDetail.locations.map((loc, idx) => (
                                <span key={loc} className={cn(loc === "S/P" ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400")}>
                                  {loc}{idx < palletDetail.locations.length - 1 ? " â€¢ " : ""}
                                </span>
                              ))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPalletId(null)} className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-all border border-slate-100 dark:border-slate-800 group"><X size={20} className="md:w-6 md:h-6 group-hover:rotate-90 transition-transform" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 text-left">
                    <div className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 transition-colors">
                      <table className="w-full">
                        <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm">
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-left">
                            <th className="px-8 py-6 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Conteúdo / SKU</th>
                            <th className="px-8 py-6 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {palletDetail.items.map((item: any, idx: number) => (
                            <tr key={`${item.produto}-${idx}`} className="group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                  <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white dark:group-hover:bg-orange-600 dark:group-hover:text-white transition-colors shadow-sm">
                                    <Package size={18} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-base font-black text-slate-800 dark:text-slate-200 transition-colors">{item.produto}</span>
                                    {item.descricao && item.descricao !== "-" && (
                                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate max-w-[300px]">
                                        {item.descricao}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-6 text-right">
                                <span className="text-lg font-black text-slate-900 dark:text-slate-100 transition-colors">{fmtNum(item.quantidade_total)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-8 md:mt-12 p-6 md:p-8 rounded-[2.5rem] bg-slate-900 dark:bg-slate-700 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                        <Info size={24} className="text-orange-400" />
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-bold leading-relaxed text-slate-300">
                          Este palete é classificado como <span className="text-orange-400 font-black">MISTO</span> por conter {palletDetail.items.length} registros distintos.
                        </p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">SISTEMA AG-G300 â€¢ AUDITORIA DE PALETES</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* --- CONFRONTO DETAIL MODAL --- */}
          <AnimatePresence>
            {selectedConfrontoItem && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-colors">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedConfrontoItem(null)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" />
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-center text-slate-600 dark:text-slate-400">
                        <Package size={18} />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">{selectedConfrontoItem.produto}</h3>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 max-w-[250px] sm:max-w-sm line-clamp-1">{selectedConfrontoItem.descricao}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedConfrontoItem(null)} className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors"><X size={16} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-4 transition-colors shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Qtd Física</span>
                          {selectedConfrontoItem.teve_ajuste && <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-bold leading-none">+ Ajuste</span>}
                        </div>
                        <span className="text-3xl font-semibold text-slate-800 dark:text-slate-100">{fmtNum(selectedConfrontoItem.qtd_fisica)}</span>
                        {selectedConfrontoItem.teve_ajuste && (
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1">Orig: {fmtNum(selectedConfrontoItem.qtd_fisica_original)}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-4 transition-colors shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Qtd Sistema</span>
                        <span className="text-3xl font-semibold text-slate-800 dark:text-slate-100">{fmtNum(selectedConfrontoItem.qtd_sistema)}</span>
                      </div>
                    </div>

                    <div className={cn("border rounded-xl p-5 flex flex-col items-center justify-center text-center transition-colors shadow-sm mt-3",
                      selectedConfrontoItem.diferenca > 0 ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" :
                        selectedConfrontoItem.diferenca < 0 ? "border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20" :
                          "border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30"
                    )}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Situação Atual</span>
                      <span className={cn("text-4xl font-bold tracking-tight",
                        selectedConfrontoItem.diferenca > 0 ? "text-emerald-600 dark:text-emerald-400" :
                          selectedConfrontoItem.diferenca < 0 ? "text-rose-600 dark:text-rose-400" :
                            "text-slate-800 dark:text-slate-200"
                      )}>
                        {selectedConfrontoItem.diferenca === 0 ? "Bateu" : (
                          `${selectedConfrontoItem.diferenca > 0 ? "+" : ""}${selectedConfrontoItem.diferenca}`
                        )}
                      </span>
                      {selectedConfrontoItem.diferenca !== 0 ? (
                        <p className="text-[11px] font-medium mt-2 text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
                          {selectedConfrontoItem.diferenca > 0 ? (
                            <>Há <span className="font-bold text-emerald-600 dark:text-emerald-400">{Math.abs(selectedConfrontoItem.diferenca)} peças</span> a mais no {confrontoType === 'fisico_x_a501' ? 'físico' : 'A501'}.</>
                          ) : (
                            <>Faltam <span className="font-bold text-rose-600 dark:text-rose-400">{Math.abs(selectedConfrontoItem.diferenca)} peças</span> no {confrontoType === 'fisico_x_a501' ? 'físico' : 'A501'}.</>
                          )}
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium mt-2 text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
                          Os volumes {confrontoType === 'fisico_x_a501' ? 'físico e do sistema' : 'A501 e G501'} estão alinhados.
                        </p>
                      )}

                      {selectedConfrontoItem.teve_ajuste && (
                        <div className="mt-4 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-left w-full">
                          <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 mb-1.5">
                            <Settings size={12} />
                            Ajuste de {selectedConfrontoItem.ajuste_quantidade > 0 ? "+" : ""}{selectedConfrontoItem.ajuste_quantidade} Aplicado
                          </h4>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            {selectedConfrontoItem.motivo_ajuste}
                          </p>
                        </div>
                      )}
                    </div>

                    {(() => {
                      const productPositions = data.filter((item: any) => item.produto === selectedConfrontoItem.produto);
                      if (productPositions.length === 0) return null;

                      // Agrupando posições
                      const posicoesAgrupadas = productPositions.reduce((acc: any, current: any) => {
                        const posicao = current.posicao || "S/P";
                        // Se Armazém não vier na base, deixa um fallback vazio para não bater o undefined.
                        const armazem = current.armazem || current.g3 || "-";
                        const quantidade = current.quantidade_total || 0;

                        const existing = acc.find((item: any) => item.posicao === posicao);
                        if (existing) {
                          existing.quantidade_agrupada += quantidade;
                        } else {
                          acc.push({ posicao, armazem, quantidade_agrupada: quantidade });
                        }
                        return acc;
                      }, []);

                      const posicoesAgrupadasLocal = selectedConfrontoItem.diferenca !== 0
                        ? posicoesAgrupadas.sort((a: any, b: any) => b.quantidade_agrupada - a.quantidade_agrupada)
                        : posicoesAgrupadas;

                      return (
                        <div className="border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30">
                            <h4 className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Aba de posições ({posicoesAgrupadasLocal.length})</h4>
                          </div>
                          <div className="max-h-40 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50/50 dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Posição</th>
                                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Qtd</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {posicoesAgrupadasLocal.map((p: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors">{p.posicao}</td>
                                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 text-right transition-colors">{fmtNum(p.quantidade_agrupada)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showExportConfigModal && (
              <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-6 transition-colors">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowExportConfigModal(false)} className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xl" />
                <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-lg rounded-[2.5rem] bg-white dark:bg-slate-900 p-6 md:p-8 shadow-[0_40px_100px_rgba(0,0,0,0.4)] border border-white/20 dark:border-slate-800 flex flex-col overflow-hidden transition-colors">

                  {/* Modal Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/30">
                        <TableIcon size={28} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Exportar Relatório</h3>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1">Configuração de Saída {exportFormat === "pdf" ? "PDF" : "EXCEL"}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowExportConfigModal(false)} className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors border border-slate-100 dark:border-slate-800"><X size={24} /></button>
                  </div>

                  <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex gap-1.5 border border-slate-200 dark:border-slate-800 shadow-inner">
                    <button
                      onClick={() => setExportFormat("excel")}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-2",
                        exportFormat === "excel"
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105 z-10"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 hover:bg-slate-200/50"
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full", exportFormat === "excel" ? "bg-white animate-pulse" : "bg-emerald-600/30")} />
                      Planilha Excel
                    </button>
                    <button
                      onClick={() => setExportFormat("pdf")}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-2",
                        exportFormat === "pdf"
                          ? "bg-rose-700 text-white shadow-lg shadow-rose-700/20 scale-105 z-10"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 hover:bg-slate-200/50"
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full", exportFormat === "pdf" ? "bg-white animate-pulse" : "bg-rose-700/30")} />
                      Relatório PDF
                    </button>
                  </div>

                  {/* Sub-Tabs: Simple vs Advanced */}
                  <div className="flex border-b border-slate-200 dark:border-slate-800 pb-1">
                    <button
                      onClick={() => setExportTab("simple")}
                      className={cn(
                        "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative",
                        exportTab === "simple" ? "text-blue-600" : "text-slate-400 hover:text-slate-500"
                      )}
                    >
                      Seleção Simples
                      {exportTab === "simple" && <motion.div layoutId="exportTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                    </button>
                    <button
                      onClick={() => setExportTab("advanced")}
                      className={cn(
                        "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative",
                        exportTab === "advanced" ? "text-blue-600" : "text-slate-400 hover:text-slate-500"
                      )}
                    >
                      Filtros Avançados
                      {exportTab === "advanced" && <motion.div layoutId="exportTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {exportTab === "simple" ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-4 rounded-[2rem] bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50"
                      >
                        <div className="h-20 w-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 mb-2">
                          <Zap size={32} />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-900 dark:text-white mb-1">Exportação Completa</h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">Resumo rápido de todos os itens filtrados</p>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[240px]">
                          Esta opção gera um relatório com todos os saldos, localizações e status configurados automaticamente.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="p-4 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 space-y-4"
                      >
                        {/* Grupo 1: Categorias de Carga */}
                        <div className="space-y-3 text-left">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">1. Categorias de Carga</p>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { id: "includeWet", label: "Produtos Molhados", icon: Droplet },
                              { id: "includeTilted", label: "Produtos Tombados", icon: Flame },
                              { id: "includeTraditional", label: "Estoque Tradicional / Outras", icon: ShieldCheck }
                            ].map((opt) => (
                              <div
                                key={opt.id}
                                onClick={() => setExportOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }))}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border",
                                  exportOptions[opt.id as keyof typeof exportOptions]
                                    ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
                                    : "bg-transparent border-transparent opacity-40 grayscale"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <opt.icon size={14} className={cn(exportOptions[opt.id as keyof typeof exportOptions] ? "text-blue-600" : "text-slate-400")} />
                                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">{opt.label}</span>
                                </div>
                                <div className={cn("h-5 w-5 rounded border-2 flex items-center justify-center transition-colors", exportOptions[opt.id as keyof typeof exportOptions] ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-600")}>
                                  {exportOptions[opt.id as keyof typeof exportOptions] && <CheckSquare size={12} className="text-white" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 mx-1" />

                        {/* Grupo 2: Localização */}
                        <div className="space-y-3 text-left">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">2. Localização</p>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: "includeAllocated", label: "Alocado (G300)" },
                              { id: "includeNotAllocated", label: "Sem End. (S/P)" }
                            ].map((opt) => (
                              <div
                                key={opt.id}
                                onClick={() => setExportOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }))}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border",
                                  exportOptions[opt.id as keyof typeof exportOptions]
                                    ? "bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-900/50 shadow-sm"
                                    : "bg-transparent border-transparent opacity-40 grayscale"
                                )}
                              >
                                <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">{opt.label}</span>
                                <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shadow-sm", exportOptions[opt.id as keyof typeof exportOptions] ? "bg-emerald-600 border-emerald-600" : "border-slate-300 dark:border-slate-600")}>
                                  {exportOptions[opt.id as keyof typeof exportOptions] && <CheckSquare size={10} className="text-white" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 mx-1" />

                        {/* Grupo 3: Status / Saldo */}
                        <div className="space-y-3 text-left">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">3. Status do Saldo</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "includeNormal", label: "Normal" },
                              { id: "includeDivergent", label: "Divergente" },
                              { id: "includeRejected", label: "Rejeitado" }
                            ].map((opt) => (
                              <div
                                key={opt.id}
                                onClick={() => setExportOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }))}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border",
                                  exportOptions[opt.id as keyof typeof exportOptions]
                                    ? "bg-white dark:bg-slate-800 border-slate-900 dark:border-slate-100/30 shadow-sm"
                                    : "bg-transparent border-transparent opacity-40 grayscale"
                                )}
                              >
                                <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">{opt.label}</span>
                                <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shadow-sm", exportOptions[opt.id as keyof typeof exportOptions] ? "bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100" : "border-slate-300 dark:border-slate-600")}>
                                  {exportOptions[opt.id as keyof typeof exportOptions] && <CheckSquare size={10} className={cn(opt.id === "includeNormal" ? "text-white" : "text-white dark:text-slate-900")} />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 mx-2" />

                        {/* Grupo 4: Detalhamento */}
                        <div className="space-y-3 text-left">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">4. Detalhamento</p>
                          <div
                            onClick={() => setExportOptions(prev => ({ ...prev, includeObservations: !prev.includeObservations }))}
                            className={cn(
                              "flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border",
                              exportOptions.includeObservations
                                ? "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-900/50 shadow-sm"
                                : "bg-transparent border-transparent opacity-40 grayscale"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <MessageSquare size={14} className={cn(exportOptions.includeObservations ? "text-blue-600" : "text-slate-400")} />
                              <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">Incluir Observações</span>
                            </div>
                            <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shadow-sm", exportOptions.includeObservations ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-600")}>
                              {exportOptions.includeObservations && <CheckSquare size={10} className="text-white" />}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Footer Action */}
                  <div className="mt-6 flex gap-4">
                    <button onClick={() => setShowExportConfigModal(false)} className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95">Cancelar</button>
                    <button onClick={executeProductExport} className="flex-[2] py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:bg-blue-500 transition-all active:scale-95 flex items-center justify-center gap-2">
                      <Download size={16} /> Gerar {exportFormat === "pdf" ? "PDF" : "Planilha"}
                    </button>
                  </div>

                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectionModeActive && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-fit"
              >
                <div className="bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-2xl px-6 py-4 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-8 min-w-[320px] md:min-w-[450px]">
                  <div className="flex flex-col text-left">
                    <span className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">Seleção Ativa</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-white text-2xl font-black">{selectedPositions.size}</span>
                      <span className="text-slate-400 text-xs font-bold uppercase">{selectedPositions.size === 1 ? "Posição Escolhida" : "Posições Escolhidas"}</span>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-white/10" />

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectionModeActive(false);
                        setSelectedPositions(new Set());
                      }}
                      className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-[11px] font-black uppercase tracking-wider transition-all active:scale-95"
                    >
                      Sair
                    </button>
                    <button
                      disabled={selectedPositions.size === 0}
                      onClick={() => handleExportSelection()}
                      className={cn(
                        "px-8 py-3 rounded-2xl text-white text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95",
                        selectedPositions.size > 0
                          ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/25 cursor-pointer"
                          : "bg-slate-700 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Printer size={14} strokeWidth={2.5} />
                      Imprimir Seleção
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedPosition && positionDetail && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 transition-colors">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPosition(null)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md" />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-7xl max-h-[92vh] rounded-3xl md:rounded-[3rem] bg-white dark:bg-slate-900 p-5 md:p-10 shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col overflow-hidden transition-colors">
                  <div className="flex items-center justify-between mb-6 md:mb-8">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="h-10 w-10 md:h-14 md:w-14 rounded-2xl md:rounded-3xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-200 dark:shadow-blue-900/20 transition-all"><MapPin size={20} className="md:w-6 md:h-6" /></div>
                      <div className="text-left">
                        <h3 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white transition-colors">{selectedPosition}</h3>
                        <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] animate-in fade-in slide-in-from-left duration-700">
                            {fmtNum(positionDetail.occupied)} / {positionDetail.capacidade} Paletes • {Math.round(positionDetail.level_count)} Níveis (0-{Math.round(positionDetail.level_count) - 1})
                          </span>
                          {positionDetail.isOverflow && (
                            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[8px] font-black uppercase text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                              <AlertCircle size={8} /> Excesso
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!!user && (
                        <button
                          onClick={() => {
                            const event = new CustomEvent("trigger-drivein-edit");
                            window.dispatchEvent(event);
                          }}
                          title="Editar Posição"
                          className="h-10 px-4 md:h-12 md:px-5 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 transition-all border bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800"
                        >
                          <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Editar</span>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedPosition(null)}
                        className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-all border border-slate-100 dark:border-slate-800"
                      >
                        <X size={20} className="md:w-6 md:h-6" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                    <DriveInGrid
                      positionId={selectedPosition}
                      products={positionDetail.products}
                      capacity={positionDetail.capacidade}
                      levelCount={positionDetail.level_count}
                      isBlocked={positionDetail.is_blocked}
                      observation={positionDetail.observacao_pos}
                      onEditSuccess={() => {
                        fetchData()
                      }}
                      availableStocks={stats?.divergences || []}
                      mapeamentoData={data}
                    />
                  </div>




                  {positionDetail.isOverflow && (
                    <div className="mt-4 p-5 rounded-[2rem] bg-red-600 text-white flex items-center gap-4 shadow-xl shadow-red-500/20 border border-red-500/50 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <AlertCircle size={24} className="animate-pulse shrink-0" />
                      <div className="text-left">
                        <p className="text-[11px] font-black uppercase tracking-tight">ALERTA DE CAPACIDADE EXCEDIDA</p>
                        <p className="text-[10px] font-bold text-red-100 leading-tight">
                          Esta posição contém {fmtNum(positionDetail.occupied)} paletes, ultrapassando o limite de {positionDetail.capacidade}. Verifique o mapeamento logístico na planilha.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Modal Importar Configuração de Ajuste */}
          <AnimatePresence>
            {showImportarAjustesModal && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowImportarAjustesModal(false)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm" />
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">

                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <DownloadCloud size={20} className="text-orange-600 dark:text-orange-500" />
                      Importar Ajustes
                    </h3>
                    <button onClick={() => setShowImportarAjustesModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    Cole abaixo o código de configuração gerado por outro usuário (através do botão "Compartilhar Ajustes"). Isso irá <strong className="text-slate-800 dark:text-slate-200">substituir</strong> sua configuração atual caso possua alguma ativa.
                  </p>

                  <form onSubmit={handleImportAjustes} className="space-y-4">
                    <div>
                      <textarea
                        required
                        rows={4}
                        value={importarAjustesText}
                        onChange={(e) => setImportarAjustesText(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white font-mono focus:outline-none focus:border-orange-500 resize-none shadow-inner"
                        placeholder="Cole o código aqui..."
                      />
                    </div>

                    <button type="submit" className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 mt-4">
                      <DownloadCloud size={16} /> Importar Agora
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          {/* Painel de Divergências (Lupa) - Sobras no Físico */}
          <AnimatePresence>
            {showDivergences && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }} 
                  onClick={() => setShowDivergences(false)} 
                  className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md" 
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                  animate={{ scale: 1, opacity: 1, y: 0 }} 
                  exit={{ scale: 0.9, opacity: 0, y: 20 }} 
                  className="relative w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col overflow-hidden"
                >
                  {/* Header do Modal */}
                  <div className="px-8 pt-8 pb-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
                        <Search size={22} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">
                          Produtos em Sobra
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          Mapeamento &gt; Registro do Sistema
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowDivergences(false)} 
                      className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Conteúdo - Lista de Divergências */}
                  <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 cursor-default">
                    {stats?.divergenciasLupa && stats.divergenciasLupa.length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-[1fr_repeat(3,_auto)] gap-4 px-4 py-2 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 dark:border-slate-800/50">
                          <span>Produto / SKU</span>
                          <span className="text-right w-16">Mapped.</span>
                          <span className="text-right w-16">Regis.</span>
                          <span className="text-right w-16 text-amber-600 dark:text-amber-400">Sobra</span>
                        </div>
                        {stats.divergenciasLupa.map((item: any, i: number) => (
                          <motion.div 
                            key={item.sku}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="group grid grid-cols-[1fr_repeat(3,_auto)] gap-4 items-center px-4 py-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                          >
                            <span className="text-sm font-black text-slate-800 dark:text-slate-200 truncate pr-2">
                              {item.sku}
                            </span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 text-right w-16">
                              {fmtNum(item.mapQty)}
                            </span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 text-right w-16">
                              {fmtNum(item.regQty)}
                            </span>
                            <div className="flex flex-col items-end w-16">
                              <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                                +{fmtNum(item.diff)}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-48 flex flex-col items-center justify-center text-center opacity-40">
                        <CheckSquare size={48} className="mb-4 text-emerald-500" />
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest"
                        >
                          Tudo em ordem!
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">
                          Nenhuma sobra física detectada no mapeamento atual.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Rodapé Informativo */}
                  <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                    <AlertCircle size={12} className="inline mr-1.5 mb-0.5" />
                    As sobras são identificadas quando a soma total encontrada nas posições (inclusive no chão) supera o saldo operacional registrado no sistema.
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Mobile Spacer (replaces non-functional menu) */}

          {/* PDF Print Template (Multi-Page Support) */}
          {
            isExportingPDF && printData.length > 0 && (
              <div className="hidden print:block relative bg-white min-h-screen w-full text-black font-sans leading-tight p-6">

                {/* Header Corporativo Ultra Compacto */}
                <div className="border-b-[1.5px] border-black pb-2 mb-4 flex justify-between items-end">
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-black/50 mb-0.5">Auditoria Logística G300</p>
                    <h1 className="text-xl font-black uppercase tracking-tight leading-none mb-1">Relação de Produtos e Divergências</h1>
                    <div className="flex gap-3 text-[6px] font-bold uppercase">
                      <span>Status: {exportTab === "simple" || (exportOptions.includeWet && exportOptions.includeTilted && exportOptions.includeTraditional) ? 'Todas' : [exportOptions.includeWet && 'Molhados', exportOptions.includeTilted && 'Tombados', exportOptions.includeTraditional && 'Tradicional'].filter(Boolean).join(' + ')}</span>
                      <span className="text-black/20">|</span>
                      <span>Local: {exportTab === "simple" || (exportOptions.includeAllocated && exportOptions.includeNotAllocated) ? 'Todos' : exportOptions.includeAllocated ? 'Alocados' : 'S/P'}</span>
                      <span className="text-black/20">|</span>
                      <span>Status: {exportTab === "simple" || (exportOptions.includeNormal && exportOptions.includeDivergent && exportOptions.includeRejected) ? 'Todos' : [exportOptions.includeNormal && 'Normal', exportOptions.includeDivergent && 'Divergente', exportOptions.includeRejected && 'Rejeitado'].filter(Boolean).join(' + ')}</span>
                      {exportOptions.includeObservations && (
                        <>
                          <span className="text-black/20">|</span>
                          <span>Obs: Sim</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-[10px] font-bold">{new Date().toLocaleDateString('pt-BR')} â€” {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                {/* Resumo Gerencial Ultra Compacto */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="px-3 py-2 border border-black flex items-center justify-between">
                    <span className="text-[7px] font-bold uppercase text-black/60 tracking-wider">SKUs Auditados:</span>
                    <span className="text-sm font-black">{printData.length}</span>
                  </div>
                  <div className="px-3 py-2 border border-black flex items-center justify-between">
                    <span className="text-[7px] font-bold uppercase text-black/60 tracking-wider">Peças Físicas G300:</span>
                    <span className="text-sm font-black">{printData.reduce((acc, curr) => acc + curr.quantidade_total, 0).toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                {/* Tabela de Dados Formal */}
                <table className="w-full text-[9px] border-collapse">
                  <thead className="print:table-header-group">
                    <tr className="border-y-[1.5px] border-black bg-slate-50/50">
                      <th className="px-3 py-2 text-left font-bold uppercase tracking-tight w-[85px]">SKU</th>
                      <th className="px-3 py-2 text-left font-bold uppercase tracking-tight w-[240px]">Descrição</th>
                      <th className="px-3 py-2 text-right font-bold uppercase tracking-tight w-[60px]">PÇS</th>
                      <th className="px-3 py-2 text-right font-bold uppercase tracking-tight w-[45px]">PLTS</th>
                      <th className="px-3 py-2 text-right font-bold uppercase tracking-tight w-[45px]">POS</th>
                      {exportOptions.includeWet && <th className="px-3 py-2 text-right font-bold uppercase tracking-tight w-[55px]">Molhado</th>}
                      {exportOptions.includeTilted && <th className="px-3 py-2 text-right font-bold uppercase tracking-tight w-[55px]">Tombado</th>}
                      {exportOptions.includeObservations && <th className="px-3 py-2 text-left font-bold uppercase tracking-tight">Obs.</th>}
                    </tr>
                  </thead>
                  <tbody className="">
                    {printData.map((item, idx) => (
                      <tr key={idx} className="border-b border-black/10 break-inside-avoid">
                        <td className="px-3 py-1.5 font-bold">{item.produto}</td>
                        <td className="px-3 py-1.5 font-medium">{item.descricao}</td>
                        <td className="px-3 py-1.5 text-right font-black">{item.quantidade_total.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{item.total_paletes}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{item.total_posicoes}</td>
                        {exportOptions.includeWet && <td className="px-3 py-1.5 text-right font-bold">{item.dmg_molhado.toLocaleString('pt-BR')}</td>}
                        {exportOptions.includeTilted && <td className="px-3 py-1.5 text-right font-bold">{item.dmg_tombada.toLocaleString('pt-BR')}</td>}
                        {exportOptions.includeObservations && (
                          <td className="px-3 py-1.5 font-normal text-black/70 italic text-[7px] leading-snug">
                            {item.observacao}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        {/* Floating Action Bar for Selected floor pallets */}
        <AnimatePresence>
          {displayMode === "nao_alocados" && selectedNaoAlocados.size > 0 && (
            <motion.div 
              initial={{ y: 100, x: "-50%", opacity: 0 }}
              animate={{ y: 0, x: "-50%", opacity: 1 }}
              exit={{ y: 100, x: "-50%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-10 left-1/2 z-50 flex items-center gap-6 bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-3xl px-8 py-4 px-10 ring-1 ring-white/10"
            >
              <div className="flex flex-col">
                <span className="text-white text-base font-black tracking-tight">{selectedNaoAlocados.size} selecionado{selectedNaoAlocados.size > 1 ? "s" : ""}</span>
                <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest leading-none mt-0.5">Gestão de Chão</span>
              </div>
              
              <div className="h-8 w-px bg-slate-700/50 mx-2"></div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowGroupModal(true)} 
                  disabled={isProcessingGroup}
                  className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 group/btn"
                >
                  <div className="h-6 w-6 rounded-lg bg-white/20 flex items-center justify-center group-hover/btn:rotate-12 transition-transform">
                    <Layers size={14}/>
                  </div>
                  <span className="text-sm font-black uppercase tracking-[0.1em]">Agrupar Mix</span>
                </button>
                
                <button 
                  onClick={() => {
                    if(window.confirm(`Deseja realmente desagrupar os ${selectedNaoAlocados.size} itens selecionados?`)) {
                      handleUngroupSelected()
                    }
                  }} 
                  disabled={isProcessingGroup}
                  className="h-12 px-6 bg-slate-800 hover:bg-rose-900/40 text-rose-400 border border-slate-700 hover:border-rose-700/50 rounded-2xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 group/btn"
                >
                  <X size={18}/>
                  <span className="text-sm font-black uppercase tracking-[0.1em]">Limpar ID</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Group Modal */}
        <AnimatePresence>
          {showGroupModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowGroupModal(false)}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-slate-800"
              >
                <div className="p-8 md:p-10">
                  <div className="flex justify-between items-start mb-10">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600 border border-blue-600/20">
                        <Layers size={28} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black dark:text-slate-100 text-slate-800 tracking-tight">Criar Palete Misto</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Consolidação de {selectedNaoAlocados.size} Itens</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowGroupModal(false)} 
                      className="h-10 w-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>
                  
                  <form onSubmit={handleGroupSelected} className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Identificação do Palete</label>
                      <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                          <span className="font-bold text-xs uppercase tracking-tighter">ID:</span>
                        </div>
                        <input 
                          autoFocus
                          type="text" 
                          value={palletIdInput}
                          onChange={(e) => setPalletIdInput(e.target.value.toUpperCase())}
                          placeholder="EX: P.001 OU DEIXE EM BRANCO"
                          className="w-full h-16 pl-14 pr-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-black placeholder:font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all uppercase"
                        />
                      </div>
                      <div className="flex items-center gap-2 px-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sistema gera ID sequencial (P.001) automático se vazio</p>
                      </div>
                    </div>
                    
                    <button 
                      type="submit"
                      disabled={isProcessingGroup || selectedNaoAlocados.size === 0}
                      className="w-full h-16 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                    >
                      {isProcessingGroup ? (
                        <RefreshCw size={24} className="animate-spin" />
                      ) : (
                        <>
                          <span className="text-lg">Gerar Mix e Salvar</span>
                          <Check size={24} className="group-hover/btn:scale-110 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Ungroup Confirmation Modal */}
        <AnimatePresence>
          {showUngroupConfirm && ungroupTargetData && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowUngroupConfirm(false)}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-slate-800"
              >
                <div className="p-8 md:p-10 text-center">
                  <div className="mx-auto w-20 h-20 bg-rose-50 dark:bg-rose-950/30 rounded-3xl flex items-center justify-center mb-6 border border-rose-100 dark:border-rose-900/40">
                    <Trash2 className="text-rose-500" size={32} />
                  </div>
                  
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Desagrupar Palete?</h3>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                    Você tem certeza que deseja desagrupar o palete <span className="text-rose-500">{ungroupTargetData.id}</span>?<br/>
                    Todos os itens voltarão a ser unitários no sistema.
                  </p>
                  
                  <div className="space-y-3">
                    <button 
                      onClick={async () => {
                        setShowUngroupConfirm(false);
                        await handleUngroupSelected(ungroupTargetData.itemIds);
                      }}
                      disabled={isProcessingGroup}
                      className="w-full h-14 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-black rounded-2xl shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                    >
                      Sim, Desagrupar
                    </button>
                    
                    <button 
                      onClick={() => setShowUngroupConfirm(false)}
                      className="w-full h-14 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] text-slate-600 dark:text-slate-300 font-black rounded-2xl transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        </main >
      </div >

      {/* LOGIN MODAL */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="h-12 w-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600 mb-4">
                      <Lock size={24} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Área Restrita</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Identifique-se para gerenciar ajustes.</p>
                  </div>
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">E-mail Corporativo</label>
                    <div className="relative">
                      <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="usuario@empresa.com"
                        className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Senha de Acesso</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                        className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
                  >
                    {isLoggingIn ? (
                      <RefreshCw size={20} className="animate-spin" />
                    ) : (
                      <>
                        <span>Acessar Dashboard</span>
                        <LogIn size={20} />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-[10px] text-slate-400 mt-8 uppercase tracking-[0.2em] font-medium">
                  Segurança G300 &copy; 2026
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Ungroup Drop Zone */}
      <AnimatePresence>
        {draggedItem && draggedItem.id_palete && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 w-96 h-28 bg-red-500/10 backdrop-blur-xl border-2 border-dashed rounded-3xl flex items-center justify-center flex-col z-[100] shadow-2xl",
              dragOverTarget === 'global_ungroup' ? "border-red-500 bg-red-500/20 shadow-red-500/40 scale-105 transition-all duration-150" : "border-red-500/50 shadow-red-500/10 transition-all duration-150"
            )}
            onDragOver={(e) => { e.preventDefault(); handleDragOver(e, 'global_ungroup'); }}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'ungroup', null)}
          >
            <div className="text-red-500 mb-2">
              <Layers size={28} />
            </div>
            <p className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest">
              Solte aqui para Desagrupar
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {transferModalOpen && transferPayload && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => {
                if (!isTransferring) {
                  setTransferModalOpen(false);
                  setTransferPayload(null);
                  setDraggedItem(null);
                }
              }}
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-4 mx-auto">
                  <LayoutGrid size={24} />
                </div>
                
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 text-center uppercase tracking-tight mb-2">
                  {transferPayload.targetType === 'mix' 
                    ? `Mover para Mix` 
                    : (transferPayload.targetType === 'new_mix' || transferPayload.targetType === 'new_standalone_mix') 
                      ? `Criar Novo Mix` 
                      : `Desagrupar`}
                </h3>
                
                <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-6 px-4">
                  {transferPayload.targetType === 'mix' && `Adicionando ao palete ${transferPayload.targetId}.`}
                  {transferPayload.targetType === 'new_mix' && `Juntando com ${transferPayload.targetBaseItem?.produto || 'item selecionado'} para criar novo mix.`}
                  {transferPayload.targetType === 'new_standalone_mix' && `Criando um novo palete agrupado.`}
                  {transferPayload.targetType === 'ungroup' && `Retirando do mix atual.`}
                </p>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produto</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Max</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-slate-700 dark:text-line-200 truncate pr-4">{transferPayload.sourceItem.produto || "Desconhecido"}</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {transferPayload.sourceItem.quantidade_total}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Quantidade a Mover</label>
                  <input
                    type="number"
                    value={transferQuantity}
                    onChange={(e) => setTransferQuantity(e.target.value)}
                    max={transferPayload.sourceItem.quantidade_total}
                    className="w-full h-14 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center text-xl font-black text-slate-800 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    disabled={isTransferring}
                    onClick={() => { setTransferModalOpen(false); setTransferPayload(null); setDraggedItem(null); }}
                    className="flex-1 py-4 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    CANCELAR
                  </button>
                  <button
                    disabled={isTransferring}
                    onClick={handleConfirmTransfer}
                    className="flex-[2] py-4 text-xs font-black text-white bg-blue-600 dark:bg-blue-500 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isTransferring ? 'PROCESSANDO...' : 'CONFIRMAR MOVER'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DIVIDIR PALETE MODAL ── */}
      <AnimatePresence>
        {splitModalOpen && splitTarget && (() => {
          const total = Number(splitTarget.quantidade_total) || 0
          const extractedQty = parseInt(splitQtyPerPallet) || 0
          const isValid = extractedQty > 0 && extractedQty < total
          const remaining = total - extractedQty
          return (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => !isSplitting && (setSplitModalOpen(false), setSplitTarget(null), setSplitQtyPerPallet(""))}
              />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-4 mx-auto">
                    <Scissors size={24} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 text-center uppercase tracking-tight mb-1">Retirar peças</h3>
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mb-5">
                    Retirar peças de <span className="font-black text-slate-700 dark:text-slate-200">{splitTarget.produto}</span> ({total} un.) para enviar pro chão.
                  </p>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-4 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <span>Total do palete</span>
                      <span className="text-slate-700 dark:text-slate-300">{total} un.</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Quantidade a retirar</label>
                    <input
                      type="number"
                      min={1}
                      max={total - 1}
                      value={splitQtyPerPallet}
                      onChange={e => setSplitQtyPerPallet(e.target.value)}
                      placeholder="ex: 10"
                      className="w-full h-14 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center text-xl font-black text-slate-800 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>

                  {isValid && (
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-3 mb-5">
                      <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Resultado</p>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2">
                          <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">Nova Quantidade (Palete):</span>
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 ml-auto">{remaining} un.</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2">
                          <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">1 Novo Palete criado com:</span>
                          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 ml-auto">{extractedQty} un.</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button disabled={isSplitting} onClick={() => { setSplitModalOpen(false); setSplitTarget(null); setSplitQtyPerPallet("") }}
                      className="flex-1 py-4 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                      CANCELAR
                    </button>
                    <button disabled={isSplitting || !isValid} onClick={handleSplitPallets}
                      className="flex-[2] py-4 text-xs font-black text-white bg-blue-600 dark:bg-blue-500 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                      {isSplitting ? <><RefreshCw size={14} className="animate-spin" /> RETIRANDO...</> : <><Scissors size={14} /> RETIRAR PEÇAS</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )
        })()}
      </AnimatePresence>

      {/* ── JUNTAR OU MOVER PALETES MODAL ── */}
      <AnimatePresence>
        {mergeModalOpen && mergeTarget && (() => {
          const itemsToRender = mergeTarget.items.filter(i => selectedMergeIds.has(i.id))
          
          const totalDisponivel = itemsToRender.reduce((s, i) => s + (parseFloat(i.quantidade_total) || 0), 0)
          
          const totalResultante = itemsToRender.reduce((s, i) => {
             const val = mergeQuantities[i.id];
             const qty = (val !== undefined && val !== "") ? parseFloat(String(val)) : (parseFloat(i.quantidade_total) || 0);
             return s + (isNaN(qty) ? 0 : qty);
          }, 0)
          
          const isValidGroup = Math.abs(totalResultante - totalDisponivel) < 0.001
          
          const grade = Number(baseCodigosMap.get(mergeTarget.sku)?.grade) || 0;
          const fullPallets = grade > 0 ? Math.floor(totalDisponivel / grade) : 0;
          const remainder = grade > 0 ? (totalDisponivel % grade) : 0;

          return (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => !isMerging && (setMergeModalOpen(false), setMergeTarget(null), setMergeQuantities({}))}
              />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 mx-auto">
                    <GitMerge size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 text-center uppercase tracking-tight mb-1">Mover Peças</h3>
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mb-5 leading-tight">
                    Os <span className="font-black text-slate-700 dark:text-slate-200">{itemsToRender.length} paletes</span> selecionados do <span className="font-black text-emerald-600 dark:text-emerald-400">{mergeTarget.sku}</span>.<br />
                    Ajuste a quantidade <span className="underline">final</span> de cada palete. O total deve se manter o mesmo.
                  </p>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-5 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                    {itemsToRender.map((item, idx) => {
                      const avail = Number(item.quantidade_total) || 0;
                      const val = mergeQuantities[item.id] !== undefined ? mergeQuantities[item.id] : avail;
                      return (
                        <div key={item.id || idx} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0 gap-2">
                          <span className="text-slate-600 dark:text-slate-400 font-medium tracking-wide">
                            Palete {idx + 1}
                          </span>
                          <input 
                            type="number" 
                            min="0"
                            value={val}
                            onChange={(e) => setMergeQuantities(prev => ({...prev, [item.id]: e.target.value === "" ? "" : Math.max(0, Number(e.target.value))}))}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-right font-black text-slate-700 dark:text-slate-300 w-24 outline-none focus:border-emerald-500 text-sm"
                          />
                        </div>
                      )
                    })}
                    <div className="flex justify-between items-center text-xs pt-3 mt-1 border-t border-slate-200 dark:border-slate-700 font-black">
                      <span className={`uppercase tracking-widest gap-2 flex items-center ${isValidGroup ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 font-bold'}`}>
                        Total Resultante
                      </span>
                      <span className={`text-sm ${isValidGroup ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 font-bold'}`}>
                        {fmtNum(totalResultante)} / {fmtNum(totalDisponivel)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {grade > 0 && (
                       <button disabled={isMerging || totalDisponivel <= 0} onClick={() => handleMergeBySku(true)}
                         className="w-full py-4 text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-40 flex flex-col items-center justify-center gap-1.5 shadow-sm">
                         <div className="flex items-center gap-2">
                           {isMerging ? <RefreshCw size={16} className="animate-spin" /> : <Layers size={16} />} 
                           AUTO FORMAR (Grade: {fmtNum(grade)})
                         </div>
                         <span className="text-[10px] font-medium opacity-80 normal-case">
                           {fullPallets > 0 || remainder > 0 ? `Vai recriar ${fullPallets > 0 ? `${fullPallets}x de ${fmtNum(grade)}` : ''}${fullPallets > 0 && remainder > 0 ? ' e ' : ''}${remainder > 0 ? `1x de ${fmtNum(remainder)}` : ''} no chão` : 'Selecione as quantidades'}
                         </span>
                       </button>
                    )}
                    <div className="flex gap-3">
                      <button disabled={isMerging} onClick={() => { setMergeModalOpen(false); setMergeTarget(null); setMergeQuantities({}) }}
                        className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        CANCELAR
                      </button>
                      <button disabled={isMerging || !isValidGroup} onClick={() => handleMergeBySku(false)}
                        className="flex-[2] py-3 text-xs font-black text-white bg-emerald-600 dark:bg-emerald-500 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                        {isMerging ? <><RefreshCw size={14} className="animate-spin" /> SALVANDO...</> : <><GitMerge size={14} /> CONFIRMAR</>}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )
        })()}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => !isDeleting && setDeleteTarget(null)}
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 mb-4 mx-auto">
                  <Trash2 size={24} />
                </div>
                
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 text-center uppercase tracking-tight mb-2">
                  Confirmar Exclusão
                </h3>
                
                <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6 px-4">
                  Deseja excluir as unidades deste registro do sistema? <b>Essa ação não pode ser desfeita.</b>
                </p>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produto</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Max</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200 truncate pr-4">{deleteTarget.produto || "Desconhecido"}</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      {deleteTarget.quantidade_total}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Quantidade a Excluir</label>
                  <input
                    type="number"
                    value={deleteQuantity}
                    onChange={(e) => setDeleteQuantity(e.target.value)}
                    max={deleteTarget.quantidade_total}
                    className="w-full h-14 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center text-xl font-black text-slate-800 dark:text-white focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                  />
                  <div className="flex justify-between mt-2 px-1">
                     <span className="text-[10px] text-slate-400">Excluir tudo?</span>
                     <button
                        onClick={() => setDeleteQuantity(String(deleteTarget.quantidade_total || "0"))} 
                        className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                     >
                        Preencher ALL
                     </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    disabled={isDeleting}
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-4 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    CANCELAR
                  </button>
                  <button
                    disabled={isDeleting}
                    onClick={executeDeleteFromChao}
                    className="flex-[2] py-4 text-xs font-black text-white bg-red-600 dark:bg-red-500 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50"
                  >
                    {isDeleting ? 'EXCLUINDO...' : 'SIM, EXCLUIR'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {isAddItemModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => !isCreatingItem && setIsAddItemModalOpen(false)}
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <PlusSquare size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Novo Item</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adicionar ao Chão (Sem Alocação)</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsAddItemModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* SKU */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU (Código) *</label>
                    <input
                      type="text"
                      placeholder="EX: 12345"
                      value={newItemData.produto}
                      onChange={(e) => setNewItemData(prev => ({ ...prev, produto: e.target.value }))}
                      className="w-full h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold text-slate-700 dark:text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>

                  {/* Quantidade */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade (Inteira) *</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="Somente números inteiros"
                      value={newItemData.quantidade}
                      onChange={(e) => setNewItemData(prev => ({ ...prev, quantidade: e.target.value }))}
                      className="w-full h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold text-slate-700 dark:text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>

                  {/* Observação */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observação</label>
                    <textarea
                      placeholder="Notas adicionais..."
                      value={newItemData.observacao}
                      onChange={(e) => setNewItemData(prev => ({ ...prev, observacao: e.target.value }))}
                      className="w-full h-24 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm font-bold text-slate-700 dark:text-white focus:border-blue-500 outline-none transition-all resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    disabled={isCreatingItem}
                    onClick={() => setIsAddItemModalOpen(false)}
                    className="flex-1 py-4 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    CANCELAR
                  </button>
                  <button
                    disabled={isCreatingItem}
                    onClick={handleCreateNewItem}
                    className="flex-[2] py-4 text-xs font-black text-white bg-blue-600 dark:bg-blue-500 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCreatingItem ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>CRIANDO...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>SALVAR ITEM</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DashboardPage;

