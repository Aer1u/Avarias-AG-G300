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
  Database,
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
  GitMerge,
  Presentation,
  Scissors,
  Repeat2,
  Fan
} from "lucide-react"
import {
  DriveInGrid,
  RegistrosTab,
  RetrabalhosTab,
  RelatorioRecebimentoTab,
  EmbalagensTab,
  EstoqueBATab,
  ProdutosTab,
  ConfrontosTab,
  GeralTab,
  MapeamentoTab,
  ClassificacoesPrintReport,
  type DevolucaoPrintPayload
} from "@/components/g300"
import { motion, AnimatePresence } from "framer-motion"
import { GlobalAdminBar } from "@/components/IAM/GlobalAdminBar"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { saveSnapshot, getSnapshot, setMetadata, getMetadata } from "@/lib/offlineDb"
import { syncManager, ConnectionStatus } from "@/lib/syncManager"
import {
  ClassificacaoPalete,
  CLASSIFICACAO_OPTIONS,
  extractRowClassificacao,
  isDevolucao,
  normalizeClassificacao,
  recomputePalletCounts,
  isMissingClassificacaoColumnError,
} from "@/lib/mapeamentoUtils"

type ViewType = "geral" | "posicoes" | "nao_alocados" | "produtos" | "molhados" | "quarentena" | "retrabalho"
type DisplayMode = "mapa" | "tabela" | "misto" | "nao_alocados" | "quarentena" | "retrabalho" | "devolucoes"
type SortType = "none" | "qty_desc" | "qty_asc" | "alpha_asc"

let nextTempId = 1;

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


const processHistoryMovements = (historicoRaw: any[] = [], period: "hoje" | "semana" | "mensal" | "all" = "all", skuLookup?: Map<string, any>) => {
    const registrosBySku = new Map<string, number>();
    const regCountBySku = new Map<string, number>();
    const regIncidenceBySku: Record<string, number> = {};
    const allSkuBalance = new Map<string, number>();
    const absoluteSkusSet = new Set<string>();

    let global_entries = 0;
    let global_exits = 0;
    let period_entries = 0;
    let period_exits = 0;
    let actual_today_entries = 0;
    let actual_today_exits = 0;
    let absolute_entries = 0;
    let absolute_exits = 0;
    let absolute_today_net = 0;
    let absolute_yesterday_net = 0;

    const todayDate = new Date();
    // Usa data LOCAL para evitar bug de UTC (Brasil = UTC-3)
    const toLocalDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day2 = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day2}`;
    };
    const todayStr = toLocalDateStr(todayDate);
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = toLocalDateStr(yesterdayDate);

    const day = todayDate.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    const allFormattedMovements = historicoRaw.reduce((acc: any[], m: any) => {
      const ent = parseBrNum(m['Entrada'] || m['entrada']);
      const sai = parseBrNum(m['Saída'] || m['saida'] || m['Saida'] || m['saída']);
      const skuRaw = String(m['Produto'] || m['produto'] || m['Código'] || m['codigo'] || m['Codigo'] || "").trim().toUpperCase();
      const sku = skuRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const dataStr = m['Data'] || m['data'] || m['created_at'] || '';
      const origRaw = m['Origem'] || m['origem'] || '-';
      const orig = origRaw.toLowerCase().trim();

      if (sku && sku !== "-" && sku !== "NAN") {
        absoluteSkusSet.add(sku);
        allSkuBalance.set(sku, (allSkuBalance.get(sku) || 0) + (ent - sai));
        regCountBySku.set(sku, (regCountBySku.get(sku) || 0) + 1);
      }
      absolute_entries += ent;
      absolute_exits += sai;

      let timestamp = 0;
      let isoDate = "";
      if (dataStr) {
        if (typeof dataStr === 'string' && dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          isoDate = dataStr;
          timestamp = new Date(dataStr + "T12:00:00Z").getTime();
        } else {
          const d = new Date(dataStr);
          timestamp = d.getTime();
          if (!isNaN(timestamp)) {
            isoDate = toLocalDateStr(d);
          }
        }
        
        if (isoDate === todayStr) absolute_today_net += (ent - sai);
        else if (isoDate === yesterdayStr) absolute_yesterday_net += (ent - sai);
      }

      if (!orig.includes('mapeamento') && !orig.includes('ajuste')) {
        if (sku && sku !== "-" && sku !== "NAN") {
          registrosBySku.set(sku, (registrosBySku.get(sku) || 0) + (ent - sai));
        }
        global_entries += ent;
        global_exits += sai;

        let isInPeriod = false;
        let isToday = false;
        if (isoDate) {
          isToday = (isoDate === todayStr);
          if (period === "hoje") isInPeriod = isToday;
          else if (period === "semana") isInPeriod = timestamp >= monday.getTime();
          else if (period === "mensal") {
             const d = new Date(timestamp);
             isInPeriod = d.getFullYear() === todayDate.getFullYear();
          } else isInPeriod = true;
        }

        if (isToday) {
          actual_today_entries += ent;
          actual_today_exits += sai;
        }
        if (isInPeriod) {
          period_entries += ent;
          period_exits += sai;
          if (ent > 0 && sku) regIncidenceBySku[sku] = (regIncidenceBySku[sku] || 0) + 1;
        }

        if (ent > 0 || sai > 0 || sku !== "") {
          const lookup = skuLookup?.get(sku);
          acc.push({
            id: m.id || Math.random(),
            produto: sku,
            descricao: lookup?.descricao || 'Produto não cadastrado',
            movimentacao: ent > 0 ? ent : sai,
            entrada: ent > 0,
            entrada_val: ent,
            saida_val: sai,
            molhado: parseBrNum(m['Quantidade Molhada'] || m['Molhado'] || m['molhado']),
            data: dataStr,
            timestamp,
            tipo: ent > 0 ? 'entrada' : 'saída',
            origem: origRaw,
            isInPeriod: isInPeriod
          });
        }
      }
      return acc;
    }, []).sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));

    return {
      registrosBySku,
      regCountBySku,
      regIncidenceBySku,
      allSkuBalance,
      absoluteSkusSet,
      global_entries,
      global_exits,
      period_entries,
      period_exits,
      actual_today_entries,
      actual_today_exits,
      absolute_entries,
      absolute_exits,
      absolute_today_net,
      absolute_yesterday_net,
      allFormattedMovements
    };
};

const calculateStatsFromData = (allData: any[], processedHistory: any) => {
    const { 
      registrosBySku, regCountBySku, regIncidenceBySku, allSkuBalance, absoluteSkusSet,
      global_entries, global_exits, period_entries, period_exits,
      actual_today_entries, actual_today_exits, absolute_entries, absolute_exits,
      absolute_today_net, absolute_yesterday_net, allFormattedMovements
    } = processedHistory;

    const mappedDriveInBySku = new Map<string, number>();
    const chaoBySku = new Map<string, number>();
    const skuMap = new Map<string, number>();
    const frequencyMap: Record<string, number> = {};
    const molhFrequencyMap: Record<string, number> = {};
    
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
    // Calculate mixed pallets count from the provided data
    const palletGroupsInternal = new Map<string, string[]>();
    allData.forEach(item => {
       const pid = String(item.id_palete || "").trim();
       if (!pid || pid === "0" || pid === "NaN") return;
       if (!palletGroupsInternal.has(pid)) palletGroupsInternal.set(pid, []);
       palletGroupsInternal.get(pid)?.push(String(item.produto || ""));
    });
    
    let mixedCount = 0;
    palletGroupsInternal.forEach(skus => {
       if (new Set(skus).size > 1) mixedCount++;
    });

    const mixed_pallets_count = mixedCount;

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
      period_movements: allFormattedMovements.filter((m: any) => m.isInPeriod),
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

function DashboardPage() {
  const normalizeSku = (s: string) => String(s || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Cálculo unificado do confronto (retrabalho e reservas A501 abatidos no físico x sistema)
  const getConfrontoCalc = (c: any) => {
    const sku = normalizeSku(c.produto);
    const isFis = confrontoType === "fisico_x_a501";
    const ajusteSoma = isFis
      ? ajustesConfronto.filter((a) => normalizeSku(a.produto) === sku).reduce((s, a) => s + a.quantidade, 0)
      : 0;
    const mapRetrab = isFis ? (retrabalhoConfrontoData.mapeamentoMap.get(sku) || 0) : 0;
    const resAberta = isFis ? (retrabalhoConfrontoData.reservasMap.get(sku) || 0) : 0;
    const qtdFisica = isFis ? Math.max(0, c.qtd_fisica - mapRetrab) + ajusteSoma : c.qtd_fisica;
    const qtdSistema = isFis ? Math.max(0, c.qtd_sistema - resAberta) : c.qtd_sistema;
    return { ajusteSoma, mapRetrab, resAberta, qtdFisica, qtdSistema, diferenca: qtdFisica - qtdSistema };
  };

  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [movimentosRaw, setMovimentosRaw] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<ConnectionStatus>("online")
  const [pendingCount, setPendingCount] = useState<number>(0)

  useEffect(() => {
    setMounted(true)
    const unsubscribeSync = syncManager.subscribe((status, count) => {
      setSyncStatus(status);
      setPendingCount(count);
      if (status === "offline") setIsOffline(true);
      else if (status === "online") setIsOffline(false);
    });

    syncManager.handleNetworkChange();

    const handleOnline = () => {
      console.log("[Network] Conexão restabelecida. Sincronizando fila...");
      setIsOffline(false);
      syncManager.syncPendingQueue().then(() => fetchData());
    };
    const handleOffline = () => {
      console.log("[Network] Conexão perdida. Modo offline ativado.");
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribeSync();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [])
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
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrollRequested, setScrollRequested] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showExportConfigModal, setShowExportConfigModal] = useState(false)
  const [showEmbSetoresModal, setShowEmbSetoresModal] = useState(false)
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

  const [selectionModeActive, setSelectionModeActive] = useState(false)
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set())
  const [topTab, setTopTab] = useState<"geral" | "mapeamento" | "produtos" | "confrontos" | "registros" | "retrabalhos" | "relatorio_recebimento" | "embalagens" | "estoque_ba">("geral")
  const relatorioRef = React.useRef<any>(null);
  const [showDivergences, setShowDivergences] = useState(false)
  const [confrontosData, setConfrontosData] = useState<any>(null)
  const [loadingConfrontos, setLoadingConfrontos] = useState(false)
  const [errorConfrontos, setErrorConfrontos] = useState<string | null>(null)
  const [confrontosCache, setConfrontosCache] = useState<Record<string, any>>({})
  const [confrontoFilter, setConfrontoFilter] = useState<"all" | "divergent" | "match" | "excess" | "missing" | "adjusted">("all")
  const [confrontoSearch, setConfrontoSearch] = useState("")
  const [confrontoSortDir, setConfrontoSortDir] = useState<"asc" | "desc">("asc")
  const [confrontoType, setConfrontoType] = useState<"fisico_x_a501" | "a501_x_g501">("fisico_x_a501")
  const [retrabalhoConfrontoData, setRetrabalhoConfrontoData] = useState<{ reservasMap: Map<string, number>; mapeamentoMap: Map<string, number> }>({ reservasMap: new Map(), mapeamentoMap: new Map() })
  const [exportFilter, setExportFilter] = useState<"tudo" | "positivado" | "negativado" | "batendo" | "divergente">("tudo")
  const [selectedConfrontoItem, setSelectedConfrontoItem] = useState<any>(null)
  const [confrontoCurrentPage, setConfrontoCurrentPage] = useState(1)
  const confrontoItemsPerPage = 10
  const [topSkusFilter, setTopSkusFilter] = useState<"geral" | "molhado" | "incidencia">("geral")
  const [topSkusSort, setTopSkusSort] = useState<"quantidade" | "incidencia">("quantidade")
  const [showTopSkusMenu, setShowTopSkusMenu] = useState(false)
  const [movementPeriod, setMovementPeriod] = useState<"hoje" | "semana" | "mensal">("hoje")

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [blinkPosition, setBlinkPosition] = useState<string | null>(null)
  const [positionViewMode, setPositionViewMode] = useState<"tabela" | "grade">("tabela")
  const [palletTrend, setPalletTrend] = useState<number | undefined>(undefined)
  const [palletHistory, setPalletHistory] = useState<{ t14: number, t17: number, t22: number, prevT22: number }>({ t14: 0, t17: 0, t22: 0, prevT22: 0 })
  const [dailyHistoryRecords, setDailyHistoryRecords] = useState<{ date: string, value: number }[]>([])

  const [baseCodigosMap, setBaseCodigosMap] = useState<Map<string, any>>(new Map())
  const [mergeQuantities, setMergeQuantities] = useState<Record<string, number | string>>({})

  // -- ESTADOS PARA CADASTRAR NOVO PRODUTO NA BASE_CODIGOS --
  const [showAddBaseCodigoModal, setShowAddBaseCodigoModal] = useState(false)
  const [newBaseCodigoData, setNewBaseCodigoData] = useState({ codigo: '', descricao: '', grade: '', tipo: '' })
  const [isSavingBaseCodigo, setIsSavingBaseCodigo] = useState(false)

  // -- ESTADOS PARA ALTERAÇÕES PENDENTES (SALVAMENTO COM CONFIRMAÇÃO) --
  const [pendingChanges, setPendingChanges] = useState<any[]>([])
  const [isCommitting, setIsCommitting] = useState(false)
  const [blockingError, setBlockingError] = useState<string | null>(null)

  // -- ESTADOS PARA CLASSIFICAÇÃO E IMPRESSÃO (REGRA B) --
  const [updatingClassificacaoId, setUpdatingClassificacaoId] = useState<string | null>(null)
  const [devolucaoPrintPayload, setDevolucaoPrintPayload] = useState<DevolucaoPrintPayload | null>(null)
  const [missingClassificacaoColumn, setMissingClassificacaoColumn] = useState(false)

  // -- APLICAÇÃO DE ALTERAÇÕES PENDENTES + REGRA A (ID + Profundidade + Nível) --
  const effectiveData = useMemo(() => {
    if (pendingChanges.length === 0) return recomputePalletCounts(data);

    const adds = [];
    const deletes = new Set();
    const updatesMap = new Map();

    for (const change of pendingChanges) {
      const id = String(change.payload?.id || change.id);
      if (change.type === 'ADD') {
        adds.push({
          ...change.payload,
          classificacao: extractRowClassificacao(change.payload),
        });
      } else if (change.type === 'DELETE') {
        deletes.add(id);
      } else if (change.type === 'UPDATE') {
        updatesMap.set(id, { ...(updatesMap.get(id) || {}), ...change.payload });
      }
    }

    const result = data
      .filter(item => !deletes.has(String(item.id)))
      .map(item => {
        const update = updatesMap.get(String(item.id));
        if (!update) return item;
        const merged = { ...item, ...update };
        if ('classificacao' in update) {
          merged.classificacao = extractRowClassificacao(update);
        }
        return merged;
      });

    return recomputePalletCounts([...result, ...adds]);
  }, [data, pendingChanges]);

  const processedHistory = useMemo(() => processHistoryMovements(movimentosRaw, movementPeriod, baseCodigosMap), [movimentosRaw, movementPeriod, baseCodigosMap]);
  const processedHistoryGlobal = useMemo(() => processHistoryMovements(movimentosRaw, "hoje", baseCodigosMap), [movimentosRaw, baseCodigosMap]);

  // Optimize: Combine stats calculation if possible, or ensure it's not wasteful
  const stats = useMemo(() => calculateStatsFromData(effectiveData, processedHistory), [effectiveData, processedHistory]);
  const globalStats = useMemo(() => calculateStatsFromData(effectiveData, processedHistoryGlobal), [effectiveData, processedHistoryGlobal]);

  const effectiveDivergences = useMemo(() => {
    return stats.divergences || [];
  }, [stats.divergences]);

  const surplusDivergences = useMemo(() =>
    effectiveDivergences.filter((d: any) => d.diff > 0 || d.available > 0) || [],
    [effectiveDivergences]
  )
  const missingDivergences = useMemo(() =>
    effectiveDivergences.filter((d: any) => d.diff < 0 && d.available <= 0) || [],
    [effectiveDivergences]
  )





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
    observacao: "",
    classificacao: "" as ClassificacaoPalete
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
         // Fracionamento de quantidade (preservando classificação individual da linha)
         const src = transferPayload.sourceItem;
         const rowClassif = extractRowClassificacao(src);
         const insertSource: Record<string, any> = {
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
            'Lote': src.lote || null,
            ...(rowClassif ? { classificacao: rowClassif } : {})
         };
         
         let { error: insErr } = await supabase.from('mapeamento').insert(insertSource);
         if (insErr && isMissingClassificacaoColumnError(insErr)) {
           setMissingClassificacaoColumn(true);
           delete insertSource.classificacao;
           const retryRes = await supabase.from('mapeamento').insert(insertSource);
           insErr = retryRes.error;
         }
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

      const splitClassif = extractRowClassificacao(splitTarget);
      const splitInsertRow: Record<string, any> = {
        'Código': splitTarget.produto,
        'Quantidade': p2Qty,
        'Posição': 'Chão',
        'Nível': 0,
        'Profundidade': 1,
        'Parte Tombada': 0,
        'Parte Molhada': 0,
        'Id Palete': null,
        'Observação': splitTarget.observacao || null,
        ...(splitClassif ? { classificacao: splitClassif } : {})
      };
      let { error: insErr } = await supabase.from('mapeamento').insert([splitInsertRow]);
      if (insErr && isMissingClassificacaoColumnError(insErr)) {
        setMissingClassificacaoColumn(true);
        delete splitInsertRow.classificacao;
        const retryRes = await supabase.from('mapeamento').insert([splitInsertRow]);
        insErr = retryRes.error;
      }
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
        const srcClassif = extractRowClassificacao(src);
        const newItems: Record<string, any>[] = [];
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
              'Observação': src?.observacao || null,
              ...(srcClassif ? { classificacao: srcClassif } : {})
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
              'Observação': src?.observacao || null,
              ...(srcClassif ? { classificacao: srcClassif } : {})
           });
        }
        
        if (newItems.length > 0) {
            let { error: insErr } = await supabase.from('mapeamento').insert(newItems);
            if (insErr && isMissingClassificacaoColumnError(insErr)) {
              setMissingClassificacaoColumn(true);
              const fallbackItems = newItems.map(({ classificacao: _c, ...rest }) => rest);
              const retryRes = await supabase.from('mapeamento').insert(fallbackItems);
              insErr = retryRes.error;
            }
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

    const qty = Math.round(parseFloat(newItemData.quantidade.replace(',', '.')));
    if (isNaN(qty) || qty <= 0) {
      alert("Quantidade inválida.");
      return;
    }

    const tempId = `novo_${nextTempId++}`;
    const normClassif = normalizeClassificacao(newItemData.classificacao);
    setPendingChanges(prev => [...prev, {
      id: tempId,
      type: 'ADD',
      payload: {
        id: tempId, // Will be replaced by DB serial/uuid
        'Código': newItemData.produto.trim().toUpperCase(),
        'Quantidade': qty,
        'Observação': newItemData.observacao.trim() || null,
        'Posição': 'Chão',
        'Id Palete': null,
        classificacao: normClassif || null,
        // Common access
        sku: newItemData.produto.trim().toUpperCase(),
        posicao: 'Chão',
        quantidade_total: qty,
        nv: null,
        pr: null
      },
      audit: {
        acao: 'ADICIONAR_ESTOQUE',
        sku: newItemData.produto.trim().toUpperCase(),
        posicao: 'Chão',
        quantidade: qty,
        classificacao: normClassif || null
      }
    }]);

    setIsAddItemModalOpen(false);
    setNewItemData({
      produto: "",
      quantidade: "",
      observacao: "",
      classificacao: ""
    });
  }

  // -- AUTENTICAÇÍO SUPABASE --
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showModuleModal, setShowModuleModal] = useState(false)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    // Tenta recuperar o e-mail salvo se existir
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) setLoginEmail(savedEmail);

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Erro na sessão:", error.message);
        if (error.message.includes("Refresh Token")) {
          supabase.auth.signOut();
        }
      }
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event as string) === 'TOKEN_REFRESH_FAILED') {
        supabase.auth.signOut();
      }
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
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

      // Salva ou remove o e-mail do localStorage baseado no 'rememberMe'
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", loginEmail);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      setShowLoginModal(false)
      setLoginPassword("")
    } catch (err: any) {
      alert("Erro ao fazer login: " + err.message)
    } finally {
      setIsLoggingIn(false)
    }
  }
  const commitChanges = async () => {
    if (pendingChanges.length === 0) return;
    setIsCommitting(true);

    const isConnected = await syncManager.checkRealConnection();

    try {
      if (!isConnected) {
        for (const change of pendingChanges) {
          if (change.type === 'ADD') {
            await syncManager.addOperation({
              type: 'ADD',
              table: 'mapeamento',
              changes: change.payload,
              audit: change.audit
            });
          } else if (change.type === 'DELETE') {
            await syncManager.addOperation({
              type: 'DELETE',
              table: 'mapeamento',
              recordId: change.id,
              changes: change.payload,
              audit: change.audit
            });
          } else if (change.type === 'UPDATE') {
            const newQty = change.payload?.['Quantidade'];
            const oldQty = change.audit?.quantidade_anterior;
            if (newQty !== undefined && oldQty !== undefined) {
              const delta = Number(newQty) - Number(oldQty);
              await syncManager.addOperation({
                type: 'QUANTITY_DELTA',
                table: 'mapeamento',
                recordId: change.payload?.id || change.id,
                field: 'Quantidade',
                delta,
                changes: change.payload,
                original: { Quantidade: oldQty },
                audit: change.audit
              });
            } else {
              await syncManager.addOperation({
                type: 'UPDATE_FIELD',
                table: 'mapeamento',
                recordId: change.payload?.id || change.id,
                changes: change.payload,
                audit: change.audit
              });
            }
          }
        }

        // --- LOCAL-FIRST PERSISTENCE ---
        // 1. Update React state data so the UI immediately reflects offline changes
        const updatedLocalData = effectiveData;
        setData(updatedLocalData);

        // 2. Persist updated mapping snapshot to IndexedDB store 'mapeamento'
        const snapshotToSave = updatedLocalData.map((item, idx) => ({
          id: item.id !== undefined && item.id !== null ? item.id : idx + 1,
          'Posição': item.posicao,
          'Código': item.sku,
          'Quantidade': item.quantidade_total,
          'Nível': item.nivel,
          'Profundidade': item.profundidade,
          'Parte Tombada': item.qtd_tombada || 0,
          'Parte Molhada': item.qtd_molhado || 0,
          'Id Palete': item.id_palete || null,
          'Observação': item.observacao || null,
          'Última Alteração': item.ultima_alteracao || null,
          'classificacao': extractRowClassificacao(item) || null
        }));
        await saveSnapshot('mapeamento', snapshotToSave);

        setPendingChanges([]);
        alert("Modo Offline: Alteração gravada no celular! Será sincronizada com o servidor assim que a conexão for reestabelecida.");
        return;
      }

      // Group by SKU to minimize floor records operations
      const adds = pendingChanges.filter(c => c.type === 'ADD');
      const deletes = pendingChanges.filter(c => c.type === 'DELETE');
      const updates = pendingChanges.filter(c => c.type === 'UPDATE');

      const ALLOWED_MAP_COLUMNS = [
        'Posição',
        'Id Palete',
        'Código',
        'Quantidade',
        'Nível',
        'Profundidade',
        'Parte Tombada',
        'Parte Molhada',
        'Observação',
        'Última Alteração',
        'classificacao'
      ];

      // 1. Process Additions
      for (const change of adds) {
        const cleanPayload: any = {};
        ALLOWED_MAP_COLUMNS.forEach(col => {
          if (change.payload[col] !== undefined) {
            cleanPayload[col] = change.payload[col];
          }
        });

        const targetPos = String(cleanPayload['Posição'] || '').trim();
        const isFloor = !targetPos || ['chão', 'chao'].includes(targetPos.toLowerCase());
        if (!isFloor) {
          // ATOMIC RPC: Insert into position and consume from floor in a single PostgreSQL transaction
          const rpcPayload: Record<string, any> = {
            "Posição": targetPos,
            "Código": String(cleanPayload['Código'] || '').trim().toUpperCase(),
            "Quantidade": Number(cleanPayload['Quantidade']) || 0,
            "Nível": cleanPayload['Nível'] ?? 0,
            "Profundidade": cleanPayload['Profundidade'] ?? 1,
            "Parte Tombada": cleanPayload['Parte Tombada'] ?? 0,
            "Parte Molhada": cleanPayload['Parte Molhada'] ?? 0,
            "Id Palete": cleanPayload['Id Palete'] ?? null,
            "Observação": cleanPayload['Observação'] ?? null,
            "classificacao": cleanPayload['classificacao'] ?? null,
          };
          const { error: rpcErr } = await supabase.rpc('rpc_add_to_position', { payload: rpcPayload });
          if (rpcErr) throw new Error(`[ERRO ATÔMICO ADICIONAR] ${rpcErr.message}`);

          // Fallback para RPC v4 se classificacao veio preenchida e o SQL v5 ainda não foi aplicado na função
          if (cleanPayload['classificacao']) {
            try {
              const { data: latestRow } = await supabase
                .from('mapeamento')
                .select('id, classificacao')
                .eq('Posição', targetPos)
                .eq('Código', String(cleanPayload['Código'] || '').trim().toUpperCase())
                .order('id', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (latestRow && !latestRow.classificacao) {
                const { error: patchErr } = await supabase
                  .from('mapeamento')
                  .update({ classificacao: cleanPayload['classificacao'] })
                  .eq('id', latestRow.id);
                if (patchErr && isMissingClassificacaoColumnError(patchErr)) {
                  setMissingClassificacaoColumn(true);
                }
              }
            } catch {
              // Silencioso caso a coluna ainda não exista
            }
          }
        } else {
          if (!cleanPayload['classificacao']) {
            delete cleanPayload['classificacao'];
          }
          let { error } = await supabase.from('mapeamento').insert(cleanPayload);
          if (error && isMissingClassificacaoColumnError(error)) {
            setMissingClassificacaoColumn(true);
            delete cleanPayload['classificacao'];
            const retryRes = await supabase.from('mapeamento').insert(cleanPayload);
            error = retryRes.error;
          }
          if (error) throw error;
        }
      }

      // 2. Process Deletions
      for (const change of deletes) {
        const targetPos = change.targetPosition || change.payload?.targetPosition || 'Retrabalho';
        const recordId = change.payload?.id || change.id;
        const skuCode = change.payload?.['Código'] || change.payload?.sku || change.audit?.sku || '';
        const qtyVal = Number(change.payload?.['Quantidade'] || change.payload?.quantidade || change.audit?.quantidade || 0);
        const tombada = Number(change.payload?.['Parte Tombada'] || 0);
        const molhada = Number(change.payload?.['Parte Molhada'] || 0);

        if (typeof recordId === 'number' || (typeof recordId === 'string' && !recordId.startsWith('temp_'))) {
          // ATOMIC RPC: Delete from position and return to target in single PostgreSQL transaction
          const { error: rpcErr } = await supabase.rpc('rpc_delete_from_position', {
            p_record_id: Number(recordId),
            p_target_pos: targetPos,
            p_sku: skuCode,
            p_qty: qtyVal,
            p_tombada: tombada,
            p_molhada: molhada,
          });
          if (rpcErr) throw new Error(`[ERRO ATÔMICO REMOVER] ${rpcErr.message}`);
        }
      }

      // 3. Process Updates
      for (const change of updates) {
        const id = change.payload.id || change.id;
        const cleanPayload: any = {};
        ALLOWED_MAP_COLUMNS.forEach(col => {
          if (change.payload[col] !== undefined) {
            cleanPayload[col] = change.payload[col];
          }
        });

        const rawQty = cleanPayload['Quantidade'];
        const newQty = (rawQty !== undefined && rawQty !== null && !isNaN(Number(rawQty)))
          ? Number(rawQty)
          : (change.audit?.quantidade ?? 0);
        const oldQty = change.audit?.quantidade_anterior ?? change.audit?.quantidade ?? newQty;
        const skuCode = cleanPayload['Código'] || change.audit?.sku || '';
        const position = cleanPayload['Posição'] || change.audit?.posicao || '';

        if (typeof id === 'number' || (typeof id === 'string' && !id.startsWith('temp_'))) {
          const hasClassifField = 'classificacao' in cleanPayload;
          const extraJson: Record<string, any> = {
            "Nível": cleanPayload['Nível'],
            "Profundidade": cleanPayload['Profundidade'],
            "Parte Tombada": cleanPayload['Parte Tombada'],
            "Parte Molhada": cleanPayload['Parte Molhada'],
            "Id Palete": cleanPayload['Id Palete'],
            ...(hasClassifField ? { "classificacao": cleanPayload['classificacao'] } : {}),
          };
          // ATOMIC RPC: Update pallet qty and adjust floor stock in single PostgreSQL transaction
          const { error: rpcErr } = await supabase.rpc('rpc_update_quantity', {
            p_record_id: Number(id),
            p_new_qty: newQty,
            p_old_qty: oldQty,
            p_sku: skuCode,
            p_position: position,
            p_extra: extraJson
          });
          if (rpcErr) throw new Error(`[ERRO ATÔMICO ATUALIZAR] ${rpcErr.message}`);

          if (hasClassifField) {
            const { error: clsErr } = await supabase
              .from('mapeamento')
              .update({ classificacao: cleanPayload['classificacao'] || null })
              .eq('id', Number(id));
            if (clsErr && isMissingClassificacaoColumnError(clsErr)) {
              setMissingClassificacaoColumn(true);
            }
          }
        }
      }

      // 4. Audit History
      const historyEntries = pendingChanges.map(c => ({
        usuario: user?.email || 'desconhecido',
        tipo_acao: c.audit.acao,
        sku: c.audit.sku || 'N/A',
        posicao: c.audit.posicao || 'N/A',
        nivel_origem: c.audit.nivel_anterior !== undefined ? c.audit.nivel_anterior : null,
        prof_origem: c.audit.prof_anterior !== undefined ? c.audit.prof_anterior : null,
        nivel_destino: c.audit.nivel !== undefined ? c.audit.nivel : null,
        prof_destino: c.audit.profundidade !== undefined ? c.audit.profundidade : null,
        quantidade: c.audit.quantidade || 0,
        id_palete: c.audit.id_palete || null,
        detalhes: JSON.stringify(c.audit)
      }));
      const { error: histErr } = await supabase.from('historico_mapeamento').insert(historyEntries);
      if (histErr) {
        // Audit log failure should not block the actual save.
        console.warn("⚠️ Histórico não registrado (RLS ou permissão):", histErr.message);
      }

      setPendingChanges([]);
      await fetchData();
      if (histErr) {
        alert("✅ Alterações salvas!\n⚠️ Histórico de movimentação não pôde ser registrado (verifique as políticas RLS da tabela 'historico_mapeamento' no Supabase).");
      } else {
        alert("✅ Alterações salvas no banco com sucesso!");
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Erro desconhecido ao salvar alterações.";
      setBlockingError(`⚠️ IMPEDITIVO DE ATOMICIDADE SALVANDO NO BANCO:\n\n${msg}\n\nNenhuma alteração parcial foi gravada no banco de dados. Resolva o problema antes de tentar novamente.`);
    } finally {
      setIsCommitting(false);
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

  // -- ESTADOS PARA IMPORTAÇÍO DE BA30001V9601 (ESTOQUE BA) --
  const [modalImportBAOpen, setModalImportBAOpen] = useState(false)
  const [importTextBA, setImportTextBA] = useState("")
  const [isImportingBA, setIsImportingBA] = useState(false)
  const [baRawList, setBaRawList] = useState<any[]>([])
  const [baSearch, setBaSearch] = useState("")

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
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" || "dark"
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
      const [posicoesRes, mapeamentoRes, historicoRes, baseCodigosRes, ajustesRes, a501Res, g501Res, baRes, paletesRes] = await Promise.all([
        fetchAllSupabaseData('posicoes'),
        fetchAllSupabaseData('mapeamento'),
        fetchAllSupabaseData('Registros'),
        fetchAllSupabaseData('base_codigos'),
        fetchAllSupabaseData('Ajuste'),
        fetchAllSupabaseData('A501'),
        fetchAllSupabaseData('G501'),
        fetchAllSupabaseData('BA30001V9601'),
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
      if (baRes.error) console.warn("Tabela BA30001V9601 inacessível:", baRes.error);
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

      // Save snapshots to IndexedDB (Fase 2)
      saveSnapshot('mapeamento', mapeamentoRaw);
      saveSnapshot('posicoes', posicoesRaw);
      if (baseCodigosRes.data) saveSnapshot('produtos', baseCodigosRes.data);
      
      const nowIso = new Date().toISOString();
      setMetadata('lastSync', nowIso);
      setMetadata('syncStatus', 'synced');
      setLastSyncTime(nowIso);
      setIsOffline(false);

      let historicoRaw = historicoRes.data || [];
      if (historicoRaw.length > 0) {
        saveSnapshot('registros', historicoRaw);
      }
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

      let baRawData = baRes?.data || [];
      if (!baRawData || baRawData.length === 0) {
        const altBa = await fetchAllSupabaseData('BA');
        if (altBa.data && altBa.data.length > 0) baRawData = altBa.data;
      }
      setBaRawList(baRawData || []);

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

      // Join items in mapping with their position info (Regra A aplicada após filtrar linhas inválidas)
      const combinedData: any[] = mapeamentoRaw.map((m: any) => {
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
        const isInvalidId = !palletId || palletId === "" || palletId === "NAN" || palletId === "-" || palletId === "S/ID" || palletId === "N/A";

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
          classificacao: extractRowClassificacao(m),
          paletes: 0,
          fracao_paletes: isInvalidId ? 1 : fracaoPaletes
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
            classificacao: '',
            is_empty: true
          });
        }
      });

      // Filter out invalid/corrupted ghost items BEFORE Regra A pallet counting
      const validCombinedData = recomputePalletCounts(
        combinedData.filter((d: any) => {
          if (d.is_empty) return true;
          const qty = Number(d.quantidade_total) || 0;
          if (qty <= 0) return false;
          const hasNoSku = !d.produto || d.produto === '-' || d.produto.trim() === '';
          if (hasNoSku) return false;
          return true;
        })
      );

      setData(validCombinedData);
      setBaseCodigosMap(skuLookup);
      // stats are now reactive via useMemo on effectiveData


    } catch (err: any) {
      console.warn("[Offline Cache] Conexão com Supabase indisponível. Carregando snapshot local do IndexedDB...", err);
      setIsOffline(true);
      setSyncStatus("offline");
      try {
        const cachedMapeamento = await getSnapshot('mapeamento');
        const cachedPosicoes = await getSnapshot('posicoes');
        const cachedProdutos = await getSnapshot('produtos');
        const savedLastSync = await getMetadata<string>('lastSync');

        if (cachedMapeamento.length > 0 || cachedPosicoes.length > 0) {
          setIsOffline(true);
          setSyncStatus("offline");
          setLastSyncTime(savedLastSync);
          setError(null);

          const skuLookup = new Map();
          cachedProdutos.forEach((c: any) => {
            const rawCod = String(c['Código'] || c['Codigo'] || c['PRODUTO'] || "").trim();
            const cod = rawCod.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (cod) {
              skuLookup.set(cod, {
                cod_original: rawCod,
                descricao: c['Descrição'] || c['Descricao'] || c['NOME'] || '',
                grade: c['Grade'] || '',
                tipo: c['Tipo'] || ''
              });
            }
          });

          const posLookup = new Map();
          cachedPosicoes.forEach((p: any) => {
            const id = String(p['Posições'] || p.posicao || "").trim();
            posLookup.set(id, {
              posicao: id,
              capacidade: Number(p['Capacidade']) || 0,
              status: p['Status'] || 'Aberto',
              observacao_pos: p['Observação'] || '',
              is_unallocated_source: !id || id === 'S/P' || id.toUpperCase() === 'CHÃO'
            });
          });

          const combinedData: any[] = recomputePalletCounts(cachedMapeamento.map((m: any) => {
            const posId = String(m['Posição'] || "").trim();
            const posInfo = posLookup.get(posId) || {
              posicao: posId || 'S/P',
              capacidade: 0,
              status: 'Aberto',
              observacao_pos: '',
              is_unallocated_source: !posId || posId === 'S/P' || posId.toUpperCase() === 'CHÃO'
            };

            const mSku = String(m['Código'] || m['Codigo'] || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let mDesc = "-";
            if (skuLookup.has(mSku)) {
              mDesc = skuLookup.get(mSku).descricao;
            }

            return {
              id: m.id,
              ...posInfo,
              id_palete: m['Id Palete'],
              produto: m['Código'],
              descricao: mDesc,
              quantidade_total: Number(m['Quantidade']) || 0,
              nivel: m['Nível'],
              profundidade: m['Profundidade'],
              qtd_tombada: Number(m['Parte Tombada']) || 0,
              qtd_molhado: Number(m['Parte Molhada']) || 0,
              ultima_alteracao: m['Última Alteração'],
              observacao: m['Observação'],
              classificacao: extractRowClassificacao(m),
              paletes: 0,
              fracao_paletes: 1
            };
          }));

          setData(combinedData);
          setBaseCodigosMap(skuLookup);
        } else {
          setError("Sem conexão com o servidor Supabase e sem dados gravados no celular.");
        }
      } catch (cacheErr) {
        setError("Falha na conexão com o Supabase: " + err.message);
      }
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
      latestRows?.forEach((row: any) => {
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
            "Id Palete": ""
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


  // Sync current stats can be removed or simplified since stats is a useMemo now
  useEffect(() => {
    setConfrontoCurrentPage(1);
  }, [confrontoSearch, confrontoFilter, confrontoType, confrontoSortDir]);

  const fetchConfrontos = async () => {
    setLoadingConfrontos(true)
    setErrorConfrontos(null)
    try {
      const { data: a501Raw, error: a501Err } = await supabase.from('A501').select('*');
      const { data: g501Raw, error: g501Err } = await supabase.from('G501').select('*');
      let { data: baRaw, error: baErr } = await supabase.from('BA30001V9601').select('*');
      if (baErr || !baRaw || baRaw.length === 0) {
        const alt = await supabase.from('BA').select('*');
        if (alt.data) baRaw = alt.data;
      }
      const { data: ajustesRaw, error: ajustesErr } = await supabase.from('Ajuste').select('*');
      const { data: reservasProgRaw } = await supabase.from('reservas_programacao').select('deposito, deposito_receptor, qtd_necessaria, quantidade_diferenca, programacao_itens(produto, status)');
      const { data: mapRetrabRaw } = await supabase.from('mapeamento').select('Código, Quantidade').eq('Posição', 'Retrabalho');

      const resProgMap = new Map<string, number>();
      (reservasProgRaw || []).forEach((r: any) => {
        const item = Array.isArray(r.programacao_itens) ? r.programacao_itens[0] : r.programacao_itens;
        if (!item || item.status === 'Concluído') return;
        const dep = String(r.deposito || '').trim().toUpperCase();
        const depRec = String(r.deposito_receptor || '').trim().toUpperCase();
        if (dep !== 'A501' && depRec !== 'A501') return;
        const openDiff = Number(r.quantidade_diferenca);
        if (openDiff > 0) {
          const sku = normalizeSku(item.produto || '');
          if (sku) resProgMap.set(sku, (resProgMap.get(sku) || 0) + openDiff);
        }
      });

      const mapRetrabMap = new Map<string, number>();
      (mapRetrabRaw || []).forEach((m: any) => {
        const sku = normalizeSku(m['Código'] || m['codigo'] || m['Produto'] || '');
        if (sku) mapRetrabMap.set(sku, (mapRetrabMap.get(sku) || 0) + (Number(m['Quantidade'] || m['quantidade']) || 0));
      });

      if (mapRetrabMap.size === 0 && effectiveData.length > 0) {
        effectiveData
          .filter((i: any) => String(i.posicao || '').toLowerCase().includes('retrabalho'))
          .forEach((item: any) => {
            const sku = normalizeSku(item.produto || '');
            if (sku) mapRetrabMap.set(sku, (mapRetrabMap.get(sku) || 0) + (Number(item.quantidade_total) || 0));
          });
      }

      setRetrabalhoConfrontoData({ reservasMap: resProgMap, mapeamentoMap: mapRetrabMap });

      if (a501Err) console.warn("Erro ao buscar A501 de Supabase:", a501Err);
      if (g501Err) console.warn("Erro ao buscar G501 de Supabase:", g501Err);
      if (baErr) console.warn("Erro ao buscar BA30001V9601 de Supabase:", baErr);
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
      const baGrouped = groupData(baRaw || [], 'Produto', 'Quantidade', 'Descrição');

      // Combine A501 + BA into sistemaGrouped for Físico vs Sistema confrontation
      const sistemaGrouped = new Map();
      const allSystemSkus = new Set([...a501Grouped.keys(), ...baGrouped.keys()]);
      allSystemSkus.forEach(sku => {
        const a501Item = a501Grouped.get(sku) || { qty: 0, desc: "-" };
        const baItem = baGrouped.get(sku) || { qty: 0, desc: "-" };
        const desc = a501Item.desc !== "-" ? a501Item.desc : baItem.desc;

        sistemaGrouped.set(sku, {
          qty: (a501Item.qty || 0) + (baItem.qty || 0),
          desc: desc || "-"
        });
      });

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
      effectiveData.forEach(item => {
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
        fisico_x_a501: processResults(fisGrouped, sistemaGrouped),
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
    effectiveData.forEach(item => {
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
          profundidade: (item.profundidade !== undefined && item.profundidade !== null && item.profundidade !== "") ? item.profundidade : ((item.Profundidade !== undefined && item.Profundidade !== null && item.Profundidade !== "") ? item.Profundidade : "-"),
          qtd_por_palete: item.qtd_por_palete || item["Quantidade/palete"] || 0,
          qtd_tombada: item.qtd_tombada || 0,
          qtd_molhado: item.qtd_molhado || 0,
          classificacao: extractRowClassificacao(item),
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
  }, [effectiveData, search])



  // View Aggregation & Filtering Logic
  const processedData = useMemo(() => {
    let baseData = []

    if (activeView === "posicoes") {
      const posMap = new Map()
      effectiveData.forEach(item => {
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
      effectiveData.forEach(item => {
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
      effectiveData.forEach(item => {
        if (item.qtd_molhado && item.qtd_molhado > 0 && item.produto && item.produto.trim() !== "") {
          skusWithWet.add(item.produto)
        }
      })

      effectiveData.forEach(item => {
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
      baseData = effectiveData.filter(item => {
        const pos = String(item.posicao || "").toUpperCase()
        return !pos || pos === "S/P" || pos === "NÃO INFORMADO" || pos === "-" || pos === "CHÃO" || pos === "CHÃO" || item.is_unallocated_source
      }).map(item => ({
        ...item,
        posicao: item.posicao || "S/P"
      }))
    } else if (activeView === "quarentena") {
      baseData = effectiveData.filter(item => {
        const pos = String(item.posicao || "").toUpperCase()
        return pos.includes("QUARENTENA")
      })
    } else if (activeView === "retrabalho") {
      baseData = effectiveData.filter(item => {
        const pos = String(item.posicao || "").toUpperCase()
        return pos === "RETRABALHO" || pos.includes("RETRABALHO")
      })
    } else {
      baseData = [...effectiveData]
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
  }, [effectiveData, activeView, sortMode, tableSort])

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

    effectiveData.forEach(item => {
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
      const isRealDrive = posUpper && posUpper !== "S/P" && posUpper !== "NÃO INFORMADO" && posUpper !== "-" && posUpper !== "CHÃO" && !posUpper.includes("QUARENTENA") && !item.is_unallocated_source
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

    effectiveData.forEach(item => {
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
    const occupied = Math.round(effectiveData.filter(i => {
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
        effectiveData.forEach(item => {
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
  }, [effectiveData, stats, topSkusFilter, topSkusSort])

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
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 tracking-wide uppercase">{String(val).toUpperCase()}</span>
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

    const matches = effectiveData.filter(item => item.posicao === selectedPosition)
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
        profundidade: (m.pos_interna !== undefined && m.pos_interna !== null && m.pos_interna !== "") ? m.pos_interna : ((m.profundidade !== undefined && m.profundidade !== null && m.profundidade !== "") ? m.profundidade : ((m.Profundidade !== undefined && m.Profundidade !== null && m.Profundidade !== "") ? m.Profundidade : "-")),
        qtd_por_palete: m.qtd_por_palete || m["Quantidade/palete"] || 0,
        qtd_tombada: m.qtd_tombada || 0,
        qtd_molhado: m.qtd_molhado || 0,
        id_palete: m.id_palete || "",
        classificacao: extractRowClassificacao(m)
      }))
    }
  }, [selectedPosition, effectiveData])

  const productDetail = useMemo(() => {
    if (!selectedProduct) return null

    const matches = effectiveData.filter(item => item.produto === selectedProduct)
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
  }, [selectedProduct, effectiveData, modalFilter])

  const palletDetail = useMemo(() => {
    if (!selectedPalletId) return null
    const items = effectiveData.filter(item => item.id_palete?.toString()?.trim() === selectedPalletId)
    if (items.length === 0) return null

    const locations = Array.from(new Set(items.map(i => i.posicao || "S/P")))

    return {
      id: selectedPalletId,
      total_qty: items.reduce((sum, i) => sum + (i.quantidade_total || 0), 0),
      total_pallets: items.reduce((sum, i) => sum + (i.paletes || 0), 0),
      locations,
      items: items.sort((a, b) => (b.quantidade_total || 0) - (a.quantidade_total || 0))
    }
  }, [selectedPalletId, effectiveData])

  // -- CLASSIFICAÇÃO INDIVIDUAL POR LINHA (REGRA B) --
  const handleUpdateRowClassificacao = async (row: any, nextValue: ClassificacaoPalete) => {
    if (!row || row.id === undefined || row.id === null) return;
    const rowIdStr = String(row.id);
    const normalized = normalizeClassificacao(nextValue);
    const dbVal = normalized || null;

    // Registro ainda pendente (novo/temp)
    if (rowIdStr.startsWith('temp_') || rowIdStr.startsWith('novo_')) {
      setPendingChanges(prev =>
        prev.map(ch =>
          String(ch.id) === rowIdStr || String(ch.payload?.id) === rowIdStr
            ? {
                ...ch,
                payload: { ...ch.payload, classificacao: dbVal },
                audit: ch.audit ? { ...ch.audit, classificacao: dbVal } : ch.audit,
              }
            : ch
        )
      );
      return;
    }

    setUpdatingClassificacaoId(rowIdStr);
    try {
      const connected = await syncManager.checkRealConnection();
      if (!connected) {
        const updated = data.map(item =>
          String(item.id) === rowIdStr ? { ...item, classificacao: normalized } : item
        );
        setData(updated);
        await syncManager.addOperation({
          type: 'UPDATE_FIELD',
          table: 'mapeamento',
          recordId: row.id,
          changes: { classificacao: dbVal },
          audit: {
            acao: 'CLASSIFICACAO',
            sku: row.produto || '',
            posicao: row.posicao || '',
            id_palete: row.id_palete || null,
            classificacao: dbVal,
          }
        });
        const snapshotToSave = updated.filter(i => !i.is_empty).map((item, idx) => ({
          id: item.id !== undefined && item.id !== null ? item.id : idx + 1,
          'Posição': item.posicao,
          'Código': item.produto,
          'Quantidade': item.quantidade_total,
          'Nível': item.nivel,
          'Profundidade': item.profundidade,
          'Parte Tombada': item.qtd_tombada || 0,
          'Parte Molhada': item.qtd_molhado || 0,
          'Id Palete': item.id_palete || null,
          'Observação': item.observacao || null,
          'Última Alteração': item.ultima_alteracao || null,
          'classificacao': extractRowClassificacao(item) || null
        }));
        await saveSnapshot('mapeamento', snapshotToSave);
        return;
      }

      const { error } = await supabase
        .from('mapeamento')
        .update({ classificacao: dbVal })
        .eq('id', Number(row.id));

      if (error) {
        if (isMissingClassificacaoColumnError(error)) {
          setMissingClassificacaoColumn(true);
          alert("⚠️ A coluna 'classificacao' ainda não foi criada na tabela 'mapeamento' do Supabase.\n\nUse o botão 'Copiar SQL' no banner de aviso no topo do Mapeamento e execute o comando no SQL Editor do Supabase.");
          return;
        }
        throw error;
      }

      setData(prev =>
        prev.map(item =>
          String(item.id) === rowIdStr ? { ...item, classificacao: normalized } : item
        )
      );
    } catch (err: any) {
      alert("Erro ao atualizar classificação: " + (err?.message || err));
    } finally {
      setUpdatingClassificacaoId(null);
    }
  };

  const handlePrintDevolucoes = (payload: DevolucaoPrintPayload) => {
    setDevolucaoPrintPayload(payload);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setDevolucaoPrintPayload(null);
      }, 600);
    }, 250);
  };

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
    let filteredData = effectiveData.filter(item => {
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
  const [a501PrintMap, setA501PrintMap] = useState<Record<string, number>>({})

  const handleExportMap = async (mode: "all" | "filtered") => {
    let dataToPrint = []
    if (mode === "all") {
      dataToPrint = effectiveData
    } else {
      if (search) {
        dataToPrint = effectiveData.filter(item =>
          Object.values(item).some(val =>
            String(val).toLowerCase().includes(search.toLowerCase())
          )
        )
      } else {
        dataToPrint = effectiveData
      }
    }

    // Buscar quantidades A501 por SKU
    try {
      const { data: a501Raw } = await supabase.from('A501').select('Produto, Quantidade')
      const map: Record<string, number> = {}
      ;(a501Raw || []).forEach((row: any) => {
        const sku = String(row['Produto'] || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (sku) map[sku] = (map[sku] || 0) + (Number(row['Quantidade']) || 0)
      })
      setA501PrintMap(map)
    } catch { /* silencioso */ }

    setPrintData(dataToPrint)
    // Small timeout to allow state to settle before printing
    setTimeout(() => {
      window.print()
      setTimeout(() => { setPrintData([]); setA501PrintMap({}) }, 500)
    }, 200)
  }


  const handleExportSelection = async () => {
    if (selectedPositions.size === 0) return
    const dataToPrint = effectiveData.filter(item => selectedPositions.has(item.posicao))

    // Buscar quantidades A501 por SKU
    try {
      const { data: a501Raw } = await supabase.from('A501').select('Produto, Quantidade')
      const map: Record<string, number> = {}
      ;(a501Raw || []).forEach((row: any) => {
        const sku = String(row['Produto'] || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (sku) map[sku] = (map[sku] || 0) + (Number(row['Quantidade']) || 0)
      })
      setA501PrintMap(map)
    } catch { /* silencioso */ }

    setPrintData(dataToPrint)
    setTimeout(() => {
      window.print()
      setTimeout(() => { setPrintData([]); setA501PrintMap({}) }, 500)
    }, 200)
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

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-sans">Carregando Painel...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <GlobalAdminBar currentWorkspaceId="ws_g300" />
      {/* Printable Report: Consulta por Classificação (Regra B - sem agrupamento da contagem geral) */}
      {devolucaoPrintPayload && (
        <ClassificacoesPrintReport payload={devolucaoPrintPayload} fmtNum={fmtNum} />
      )}

      {/* Printable Report (Hidden normally) */}
      {!devolucaoPrintPayload && printData.length > 0 && (
        <div className="hidden print:block print:bg-white print:text-black print:p-2 print:w-full">
          {isExportingPDF ? (
            /* Layout 1: Relatório de Produtos (SKU Summary) */
            <div className="font-sans">
              <div className="flex justify-between items-center border-b-[2px] border-black pb-2 mb-6">
                <div>
                  <h1 className="text-xl font-semibold uppercase tracking-tight">Relação de Produtos por Estoque</h1>
                  <p className="text-[10px] font-medium text-slate-500 uppercase">G300 PAINEL OPERACIONAL</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase">{new Date().toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] font-medium text-blue-600 uppercase">{printData.length} SKUs Encontrados</p>
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-[10px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-2 text-left font-semibold uppercase w-24">SKU</th>
                    <th className="border border-black p-2 text-left font-semibold uppercase">Descrição</th>
                    <th className="border border-black p-2 text-center font-semibold uppercase w-16">Peças</th>
                    <th className="border border-black p-2 text-center font-semibold uppercase w-16">Paletes</th>
                    <th className="border border-black p-2 text-center font-semibold uppercase w-16">Posições</th>
                    <th className="border border-black p-2 text-left font-semibold uppercase w-48">Observações</th>
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
                <p className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">Documento interno para conferência operacional — AG G300</p>
              </div>
            </div>
          ) : (
            /* Layout 2: Manifesto de Conferência (By Position Mapping) */
            <>
              <div className="flex justify-between items-center border-b-[2px] border-black pb-1 mb-4">
                <div>
                  <h1 className="text-[16px] font-semibold uppercase tracking-tight">Manifesto de Conferência de Drive - G300</h1>
                  {(() => {
                    const totalMapeado = printData.reduce((acc, curr) => acc + (Number(curr.quantidade_total || curr.quantidade) || 0), 0);
                    const uniqueSkus = Array.from(new Set(printData.map(item => String(item.produto || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).filter(Boolean)));
                    if (uniqueSkus.length === 1) {
                      const sku = uniqueSkus[0];
                      const qty = a501PrintMap[sku] || 0;
                      return (
                        <p className="text-[10.5px] font-bold text-slate-800 uppercase mt-0.5">
                          Produto: {sku} • Total Mapeado: {fmtNum(totalMapeado)} UN • Saldo A501: {fmtNum(qty)} UN
                        </p>
                      );
                    } else if (uniqueSkus.length > 1 && uniqueSkus.length <= 5) {
                      return (
                        <p className="text-[9px] font-semibold text-slate-800 uppercase mt-0.5">
                          Total Mapeado: {fmtNum(totalMapeado)} UN | Saldo A501: {uniqueSkus.map(sku => `${sku} (${fmtNum(a501PrintMap[sku] || 0)})`).join(' | ')}
                        </p>
                      );
                    } else if (uniqueSkus.length > 5) {
                      const totalA501 = uniqueSkus.reduce((sum, sku) => sum + (a501PrintMap[sku] || 0), 0);
                      return (
                        <p className="text-[10px] font-bold text-slate-800 uppercase mt-0.5">
                          Total Mapeado: {fmtNum(totalMapeado)} UN • Total Saldo A501: {fmtNum(totalA501)} UN
                        </p>
                      );
                    }
                    return (
                      <p className="text-[10.5px] font-bold text-slate-800 uppercase mt-0.5">
                        Total Mapeado: {fmtNum(totalMapeado)} UN
                      </p>
                    );
                  })()}
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-medium text-slate-500 uppercase">{new Date().toLocaleString('pt-BR')}</p>
                  <p className="text-[8px] font-bold text-blue-600 uppercase">({printData.length} Registros)</p>
                </div>
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
                          <span className="text-[12px] font-semibold tracking-tight">{posId}</span>
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
                                <span className="text-[9px] font-semibold">N{lvl}</span>
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
                                              <span className="text-[9.5px] font-semibold uppercase truncate">CÓD: {item.sku}</span>
                                            </div>
                                            <div className="w-24 px-2 flex items-center justify-end shrink-0">
                                              <span className="text-[12px] font-semibold">{fmtNum(item.portion)} UN</span>
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
          aside { display: none !important; }
          main { margin-left: 0 !important; }
        }
      ` }} />

      <div className="flex flex-col md:flex-row min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-500 no-print relative">
        {/* Mobile Top Header (< md screens) */}
        <div className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 shadow-md text-white">
                <Package size={18} />
              </div>
              <div>
                <h1 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Portal <span className="text-blue-500">AG</span></h1>
                <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">G300 Operacional</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Online/Offline status badge */}
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 border",
                syncStatus === "online" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                syncStatus === "syncing" ? "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse" :
                "bg-rose-500/10 text-rose-500 border-rose-500/20"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", syncStatus === "online" ? "bg-emerald-500" : syncStatus === "syncing" ? "bg-amber-500" : "bg-rose-500")} />
                {syncStatus === "online" ? "Online" : syncStatus === "syncing" ? "Sync" : "Offline"}
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800"
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              </button>

              {/* Mobile Menu Hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {/* Scrollable Horizontal Tab Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 border-t border-slate-100 dark:border-slate-800/60">
            {[
              { id: 'geral', label: 'Dashboard', icon: Layout },
              { id: 'mapeamento', label: 'Mapeamento', icon: MapPin },
              { id: 'produtos', label: 'Produtos', icon: Box },
              { id: 'confrontos', label: 'Confrontos', icon: GitCompare },
              ...(user ? [{ id: 'registros', label: 'Monitoramento', icon: History }] : []),
              { id: 'retrabalhos', label: 'Retrabalhos', icon: RefreshCw },
              { id: 'embalagens', label: 'Embalagens', icon: Package },
              { id: 'estoque_ba', label: 'Estoque BA', icon: Database },
              ...(user ? [{ id: 'relatorio_recebimento', label: 'Rec. Mensal', icon: Droplet }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setTopTab(tab.id as any);
                  if (tab.id === 'produtos') setActiveView('produtos');
                  else if (tab.id === 'geral') setActiveView('geral');
                  else if (tab.id === 'mapeamento') {
                    if (displayMode === "nao_alocados") setActiveView("nao_alocados");
                    else if (displayMode === "quarentena") setActiveView("quarentena");
                    else setActiveView("geral");
                  }
                }}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all",
                  topTab === tab.id
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400"
                )}
              >
                <tab.icon size={13} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Drawer Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden fixed inset-x-0 top-[90px] z-40 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Módulos e Ações</span>
                <button
                  onClick={() => { window.location.href = '/'; setMobileMenuOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                >
                  <Repeat2 size={14} />
                  <span>Trocar Módulo</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Usuário:</span>
                {user ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[160px]">{user.email}</span>
                    <button
                      onClick={handleLogout}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500"
                    >
                      Sair
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowLoginModal(true); setMobileMenuOpen(false); }}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white"
                  >
                    Fazer Login
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimalist SideMenu (Desktop only) */}
        <aside className="group/sidebar hidden md:flex fixed left-0 top-0 z-50 flex h-full w-24 flex-col items-center border-none bg-white/80 py-8 backdrop-blur-xl dark:bg-slate-900/80 transition-all duration-300 hover:w-64 overflow-hidden">
          {/* Sidebar Branding (Combined) */}
          <div className="mb-12 flex flex-col items-center gap-4 px-4 w-full text-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-blue-600 shadow-xl shadow-blue-500/30">
              <Package className="text-white" size={32} />
            </div>
            <div className="flex flex-col items-center opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden w-full space-y-1">
              <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white leading-tight">Portal <span className="text-blue-600">AG</span></h2>
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em]">G300 PAINEL OPERACIONAL</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-2 w-full px-3">
            {[
              { id: 'geral', label: 'Dashboard', icon: Layout },
              { id: 'mapeamento', label: 'Mapeamento', icon: MapPin },
              { id: 'produtos', label: 'Produtos', icon: Box },
              { id: 'confrontos', label: 'Confrontos', icon: GitCompare },
              ...(user ? [{ id: 'registros', label: 'Monitoramento', icon: History }] : []),
              { id: 'retrabalhos', label: 'Retrabalhos', icon: RefreshCw },
              { id: 'embalagens', label: 'Embalagens', icon: Package },
              { id: 'estoque_ba', label: 'Estoque BA', icon: Database },
              ...(user ? [{ id: 'relatorio_recebimento', label: 'Rec. Mensal', icon: Droplet }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setTopTab(tab.id as any);
                  if (tab.id === 'produtos') setActiveView('produtos');
                  else if (tab.id === 'geral') setActiveView('geral');
                  else if (tab.id === 'mapeamento') {
                    if (displayMode === "nao_alocados") setActiveView("nao_alocados");
                    else if (displayMode === "quarentena") setActiveView("quarentena");
                    else setActiveView("geral");
                  }
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
                  "text-[11px] font-semibold uppercase tracking-wider opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap text-left",
                  topTab === tab.id ? "text-blue-600 dark:text-blue-400" : ""
                )}>
                  {tab.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-4 w-full px-4 pb-8 items-center">
            {/* Module Switcher Button */}
            <button
              onClick={() => { window.location.href = '/' }}
              className="flex h-12 w-full items-center rounded-2xl text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors overflow-hidden group/btn border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5"
              title="Trocar Módulo"
            >
              <div className="flex min-w-[48px] h-12 items-center justify-center">
                <Repeat2 size={18} className="text-emerald-500" />
              </div>
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                Trocar Módulo
              </span>
            </button>

            <button
              onClick={toggleTheme}
              className="flex h-12 w-full items-center rounded-2xl text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 transition-colors overflow-hidden group/btn"
            >
              <div className="flex min-w-[48px] h-12 items-center justify-center">
                {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
              </div>
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                {theme === "light" ? "Escuro" : "Claro"}
              </span>
            </button>

            {/* User Avatar Section */}
            <div className="relative w-full flex flex-col items-center">
              {authLoading ? (
                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700" />
              ) : (
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
                    <span className="text-sm font-semibold uppercase">{user.email[0]}</span>
                  ) : (
                    <User size={20} />
                  )}
                </button>
              )}
            </div>
          </div>
        </aside>

        <main className={cn("ml-0 md:ml-24 flex-1 overflow-x-hidden", (topTab === 'registros' || topTab === 'relatorio_recebimento' || topTab === 'retrabalhos' || topTab === 'embalagens' || topTab === 'estoque_ba') ? "flex flex-col min-h-screen p-2 md:p-3 lg:p-4" : "p-2 sm:p-4 md:p-8 lg:p-12")}>
          <div className={cn("mx-auto space-y-6 md:space-y-10", (topTab === 'registros' || topTab === 'relatorio_recebimento' || topTab === 'retrabalhos' || topTab === 'embalagens' || topTab === 'estoque_ba') ? "w-full max-w-none flex-1 flex flex-col px-2 md:px-3" : "max-w-7xl")}>

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
                              <p className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">
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
                                      "w-full text-left px-3 py-1.5 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all",
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
                                    const balance = getConfrontoCalc(c).diferenca;

                                    if (exportFilter === "positivado") return balance > 0;
                                    if (exportFilter === "negativado") return balance < 0;
                                    if (exportFilter === "batendo") return balance === 0;
                                    if (exportFilter === "divergente") return balance !== 0;
                                    return true;
                                  });

                                  const rows = data.map((c: any) => {
                                    const k = getConfrontoCalc(c);
                                    const diferenca = k.diferenca;
                                    const saldo = diferenca === 0 ? 'Bateu' : diferenca > 0 ? `+${diferenca} (Positivo)` : `${diferenca} (Negativo)`;
                                    return `<tr><td>${c.produto}</td><td>${c.descricao}</td><td>${k.qtdFisica}</td><td>${k.qtdSistema}</td><td>${saldo}</td></tr>`;
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
                                    <p className="text-xs font-normal text-slate-700 dark:text-slate-200 leading-none mb-1">Exportar PDF</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{confrontoType === 'fisico_x_a501' ? 'Físico vs Sistema' : 'A501 vs G501'}</p>
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
                                    const balance = getConfrontoCalc(c).diferenca;

                                    if (exportFilter === "positivado") return balance > 0;
                                    if (exportFilter === "negativado") return balance < 0;
                                    if (exportFilter === "batendo") return balance === 0;
                                    if (exportFilter === "divergente") return balance !== 0;
                                    return true;
                                  });

                                  const rows = data.map((c: any) => {
                                    const k = getConfrontoCalc(c);
                                    return `<tr><td>${c.produto}</td><td>${c.descricao}</td><td>${k.qtdFisica}</td><td>${k.qtdSistema}</td><td>${k.diferenca}</td></tr>`;
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
                                    <p className="text-xs font-normal text-slate-700 dark:text-slate-200 leading-none mb-1">Exportar Excel</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{confrontoType === 'fisico_x_a501' ? 'Físico vs Sistema' : 'A501 vs G501'}</p>
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
                                    <p className="text-xs font-normal text-slate-700 dark:text-slate-200 leading-none mb-1">Importar A501</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Atualizar base do sistema</p>
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
                                    <p className="text-xs font-normal text-slate-700 dark:text-slate-200 leading-none mb-1">Importar G501</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Atualizar base de vistoria</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Importar BA (BA30001V9601) */}
                            {(topTab === 'confrontos' || topTab === 'estoque_ba') && (
                              <button
                                onClick={() => {
                                  setShowAjustesMenu(false)
                                  setModalImportBAOpen(true)
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                                    <Database size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-normal text-slate-700 dark:text-slate-200 leading-none mb-1">Importar BA (BA30001V9601)</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Atualizar estoque BA</p>
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
                                    <p className="text-xs font-normal text-slate-700 dark:text-slate-200 leading-none mb-1">Importar Ajustes</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Colar código compartilhado</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Relatório Geral - only on other tabs */}
                            {topTab !== 'confrontos' && topTab !== 'relatorio_recebimento' && (
                              <button
                                onClick={() => { handleExportProducts(); setShowAjustesMenu(false); }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                    <Package size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-normal text-slate-700 dark:text-slate-200 leading-none mb-1">Relatório Geral</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Planilha Consolidada</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Exportar Apresentação - only on Relatorio Recebimento */}
                            {topTab === 'relatorio_recebimento' && (
                              <button
                                onClick={() => { relatorioRef.current?.exportPresentation(); setShowAjustesMenu(false); }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                    <Presentation size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-normal text-slate-700 dark:text-slate-200 leading-none mb-1">Exportar Apresentação</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Gerar print com OBS</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Configurar Setores - apenas na aba Embalagens */}
                            {topTab === 'embalagens' && !!user && (
                              <>
                                <div className="mx-4 my-1 border-t border-slate-100 dark:border-slate-800" />
                                <button
                                  onClick={() => { setShowEmbSetoresModal(true); setShowAjustesMenu(false); }}
                                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                      <Settings size={14} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-normal text-slate-700 dark:text-slate-200 leading-none mb-1">Configurar Setores</p>
                                      <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Definir solicitantes CD / Conserto</p>
                                    </div>
                                  </div>
                                </button>
                              </>
                            )}

                            {/* Cadastrar Produto - sempre visível para usuários logados */}
                            {!!user && (
                              <>
                                <div className="mx-4 my-1 border-t border-slate-100 dark:border-slate-800" />
                                <button
                                  onClick={() => { setShowAddBaseCodigoModal(true); setShowAjustesMenu(false); }}
                                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                                      <Plus size={14} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-normal text-slate-700 dark:text-slate-200 leading-none mb-1">Cadastrar Produto</p>
                                      <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Adicionar na Base de Códigos</p>
                                    </div>
                                  </div>
                                </button>
                              </>
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
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">Atualizando dados...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>





            <AnimatePresence>
              {topTab === "geral" && (
                <GeralTab
                  error={error}
                  loading={loading}
                  data={data}
                  effectiveData={effectiveData}
                  globalStats={globalStats}
                  stats={stats}
                  palletTrend={palletTrend}
                  advancedStats={advancedStats}
                  palletHistory={palletHistory}
                  dailyHistoryRecords={dailyHistoryRecords}
                  topSkus={topSkus}
                  topSkusFilter={topSkusFilter}
                  setTopSkusFilter={setTopSkusFilter}
                  topSkusSort={topSkusSort}
                  movementPeriod={movementPeriod}
                  setMovementPeriod={setMovementPeriod}
                  fmtNum={fmtNum}
                />
              )}

              {topTab === "produtos" && (
                <ProdutosTab
                  activeView={activeView}
                  setActiveView={setActiveView}
                  sortMode={sortMode}
                  setSortMode={setSortMode}
                  tableSort={tableSort}
                  setTableSort={setTableSort}
                  handleSort={handleSort}
                  search={search}
                  setSearch={setSearch}
                  columns={getColumns()}
                  paginatedData={paginatedData}
                  filteredData={filteredData}
                  loading={loading}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalPages={totalPages}
                  rowsPerPage={rowsPerPage}
                  setRowsPerPage={setRowsPerPage}
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
                />
              )}

              {topTab === "mapeamento" && (
                <MapeamentoTab
                  data={data}
                  setData={setData}
                  effectiveData={effectiveData}
                  pendingChanges={pendingChanges}
                  setPendingChanges={setPendingChanges}
                  globalStats={globalStats}
                  advancedStats={advancedStats}
                  streetData={streetData}
                  displayMode={displayMode}
                  setDisplayMode={setDisplayMode}
                  activeView={activeView}
                  setActiveView={setActiveView}
                  sortMode={sortMode}
                  setSortMode={setSortMode}
                  tableSort={tableSort}
                  setTableSort={setTableSort}
                  handleSort={handleSort}
                  search={search}
                  setSearch={setSearch}
                  syncStatus={syncStatus}
                  isOffline={isOffline}
                  lastSyncTime={lastSyncTime}
                  pendingCount={pendingCount}
                  fetchData={fetchData}
                  user={user}
                  setShowLoginModal={setShowLoginModal}
                  selectionModeActive={selectionModeActive}
                  setSelectionModeActive={setSelectionModeActive}
                  selectedPositions={selectedPositions}
                  setSelectedPositions={setSelectedPositions}
                  blinkPosition={blinkPosition}
                  setSelectedPosition={setSelectedPosition}
                  handleExportMap={handleExportMap}
                  handleExportSelection={handleExportSelection}
                  handleVerNoMapa={handleVerNoMapa}
                  setSelectedPalletId={setSelectedPalletId}
                  setUngroupTargetData={setUngroupTargetData}
                  setShowUngroupConfirm={setShowUngroupConfirm}
                  isProcessingGroup={isProcessingGroup}
                  setShowGroupModal={setShowGroupModal}
                  handleUngroupSelected={handleUngroupSelected}
                  selectedNaoAlocados={selectedNaoAlocados}
                  setSelectedNaoAlocados={setSelectedNaoAlocados}
                  paginatedData={paginatedData}
                  filteredData={filteredData}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalPages={totalPages}
                  rowsPerPage={rowsPerPage}
                  setRowsPerPage={setRowsPerPage}
                  getColumns={getColumns}
                  setModalFilter={setModalFilter}
                  setSelectedProduct={setSelectedProduct}
                  draggedItem={draggedItem}
                  dragOverTarget={dragOverTarget}
                  handleDragStart={handleDragStart}
                  handleDragEnd={handleDragEnd}
                  handleDragOver={handleDragOver}
                  handleDragLeave={handleDragLeave}
                  handleDrop={handleDrop}
                  updatingClassificacaoId={updatingClassificacaoId}
                  handleUpdateRowClassificacao={handleUpdateRowClassificacao}
                  missingClassificacaoColumn={missingClassificacaoColumn}
                  setMissingClassificacaoColumn={setMissingClassificacaoColumn}
                  setSplitTarget={setSplitTarget}
                  setSplitQtyPerPallet={setSplitQtyPerPallet}
                  setSplitModalOpen={setSplitModalOpen}
                  setMergeTarget={setMergeTarget}
                  setSelectedMergeIds={setSelectedMergeIds}
                  setMergeModalOpen={setMergeModalOpen}
                  setDeleteTarget={setDeleteTarget}
                  setDeleteQuantity={setDeleteQuantity}
                  setIsAddItemModalOpen={setIsAddItemModalOpen}
                  onPrintDevolucoes={handlePrintDevolucoes}
                  fmtNum={fmtNum}
                />
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

              { topTab === "retrabalhos" && (
                <motion.div
                  key="retrabalhos-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1 overflow-auto"
                >
                  <RetrabalhosTab refreshTrigger={isRefreshing} />
                </motion.div>
              )}

              { topTab === "embalagens" && (
                <motion.div
                  key="embalagens-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1 overflow-auto"
                >
                  <EmbalagensTab refreshTrigger={isRefreshing} showSetoresModal={showEmbSetoresModal} onCloseSetoresModal={() => setShowEmbSetoresModal(false)} />
                </motion.div>
              )}

              {topTab === "estoque_ba" && (
                <EstoqueBATab
                  baRawList={baRawList}
                  effectiveData={effectiveData}
                  baSearch={baSearch}
                  setBaSearch={setBaSearch}
                  fmtNum={fmtNum}
                  user={user}
                  onOpenImportModal={() => setModalImportBAOpen(true)}
                />
              )}


              { topTab === "relatorio_recebimento" && (
                <motion.div
                  key="relatorio-recebimento-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1 overflow-hidden"
                >
                  <RelatorioRecebimentoTab ref={relatorioRef} />
                </motion.div>
              )}

              {topTab === "confrontos" && (
                <ConfrontosTab
                  loadingConfrontos={loadingConfrontos}
                  confrontosData={confrontosData}
                  errorConfrontos={errorConfrontos}
                  fetchConfrontos={fetchConfrontos}
                  confrontoType={confrontoType}
                  setConfrontoType={setConfrontoType}
                  confrontoFilter={confrontoFilter}
                  setConfrontoFilter={setConfrontoFilter}
                  confrontoSearch={confrontoSearch}
                  setConfrontoSearch={setConfrontoSearch}
                  confrontoCurrentPage={confrontoCurrentPage}
                  setConfrontoCurrentPage={setConfrontoCurrentPage}
                  confrontoItemsPerPage={confrontoItemsPerPage}
                  ajustesConfronto={ajustesConfronto}
                  setAjustesConfronto={setAjustesConfronto}
                  baRawList={baRawList}
                  retrabalhoConfrontoData={retrabalhoConfrontoData}
                  effectiveData={effectiveData}
                  fmtNum={fmtNum}
                  user={user}
                  setShowLoginModal={setShowLoginModal}
                  modalAjusteOpen={modalAjusteOpen}
                  setModalAjusteOpen={setModalAjusteOpen}
                  modalImportA501Open={modalImportA501Open}
                  setModalImportA501Open={setModalImportA501Open}
                  importTextA501={importTextA501}
                  setImportTextA501={setImportTextA501}
                  isImportingA501={isImportingA501}
                  setIsImportingA501={setIsImportingA501}
                  modalImportG501Open={modalImportG501Open}
                  setModalImportG501Open={setModalImportG501Open}
                  importTextG501={importTextG501}
                  setImportTextG501={setImportTextG501}
                  isImportingG501={isImportingG501}
                  setIsImportingG501={setIsImportingG501}
                  selectedConfrontoItem={selectedConfrontoItem}
                  setSelectedConfrontoItem={setSelectedConfrontoItem}
                />
              )}
</AnimatePresence >
          </div >

          {/* Modal de Importação em Massa BA30001V9601 */}
          <AnimatePresence>
            {modalImportBAOpen && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalImportBAOpen(false)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm" />
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Database size={20} className="text-purple-600" />
                      Importar Dados BA30001V9601 (Estoque BA)
                    </h3>
                    <button onClick={() => setModalImportBAOpen(false)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {!user ? (
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Você precisa estar logado para atualizar a base de estoque BA.</p>
                      <button onClick={() => { setModalImportBAOpen(false); setShowLoginModal(true); }} className="px-6 py-2 bg-purple-600 text-white rounded-xl text-xs font-medium uppercase tracking-wider">Fazer Login</button>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 gap-6">
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Cole os dados do Excel/Sheets abaixo. Ordem esperada: <span className="font-bold text-slate-700 dark:text-slate-200">Código | Descrição | Quantidade</span> (separadas por TAB).</p>
                        <div className="relative flex-1 min-h-[300px]">
                          <textarea
                            value={importTextBA}
                            onChange={(e) => setImportTextBA(e.target.value)}
                            className="w-full h-full min-h-[300px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4 text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-purple-500 resize-none overflow-y-auto custom-scrollbar"
                            placeholder="Ex:&#10;5487-02	CAIXA AMPLIFICADA CM-150 BIVOLT	2170&#10;8998-01	CAIXA AMPLIFICADA CM-400-L	402"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
                        <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
                          <span className="font-semibold uppercase">Atenção:</span> Esta operação irá <span className="font-semibold underline italic">APAGAR TODOS</span> os registros atuais da base BA30001V9601 e substituí-los pelo conteúdo acima.
                        </p>
                      </div>

                      <button
                        disabled={isImportingBA || !importTextBA.trim()}
                        onClick={async () => {
                          let lines = importTextBA.trim().split('\n').filter(l => l.trim());
                          if (lines.length === 0) return;

                          const firstLineLower = lines[0].toLowerCase();
                          if (firstLineLower.includes("código") || firstLineLower.includes("codigo") || firstLineLower.includes("descrição") || firstLineLower.includes("descricao")) {
                            lines = lines.slice(1);
                          }

                          if (lines.length === 0) {
                            alert("Nenhum dado válido encontrado.");
                            return;
                          }

                          if (!confirm(`Confirmar importação de ${lines.length} itens? Isso substituirá a base BA30001V9601 atual.`)) return;

                          setIsImportingBA(true);
                          try {
                            const dataToInsert = lines.map(line => {
                              const cols = line.split('\t');
                              let rawQty = String(cols[2] || cols[1] || '0').trim();
                              if (cols.length === 2) {
                                rawQty = String(cols[1] || '0').trim();
                              }
                              const cleanQty = rawQty.split('.').join('').replace(',', '.');
                              return {
                                'Produto': String(cols[0] || '').trim().toUpperCase(),
                                'Código': String(cols[0] || '').trim().toUpperCase(),
                                'Descrição': cols.length >= 3 ? String(cols[1] || '-').trim() : '-',
                                'Quantidade': Number(cleanQty) || 0
                              };
                            });

                            let targetTable = 'BA30001V9601';
                            let { error: delErr } = await supabase.from(targetTable).delete().neq('Produto', 'xyz_placeholder');
                            if (delErr) {
                              targetTable = 'BA';
                              const res2 = await supabase.from(targetTable).delete().neq('Produto', 'xyz_placeholder');
                              if (res2.error) throw delErr;
                            }

                            const chunkSize = 200;
                            for (let i = 0; i < dataToInsert.length; i += chunkSize) {
                              const chunk = dataToInsert.slice(i, i + chunkSize);
                              const { error: insErr } = await supabase.from(targetTable).insert(chunk);
                              if (insErr) throw insErr;
                            }

                            alert("Importação do Estoque BA realizada com sucesso!");
                            setImportTextBA("");
                            setModalImportBAOpen(false);
                            await fetchData();
                            await fetchConfrontos();
                          } catch (err: any) {
                            console.error("Erro na importação BA:", err);
                            alert("Falha ao importar: " + err.message);
                          } finally {
                            setIsImportingBA(false);
                          }
                        }}
                        className={cn(
                          "w-full py-4 rounded-2xl font-semibold text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                          isImportingBA
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-wait"
                            : "bg-purple-600 hover:bg-purple-500 text-white shadow-xl shadow-purple-500/20 active:scale-[0.98]"
                        )}
                      >
                        {isImportingBA ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-4 w-4 border-2 border-slate-400 border-t-white rounded-full" />
                            Processando...
                          </>
                        ) : "Confirmar e Sobrescrever Base BA30001V9601"}
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
                          <h3 className="text-lg md:text-3xl font-light text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-xs">{selectedProduct}</h3>
                          {productDetail.descricao && productDetail.descricao !== "-" && (
                            <p className="text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate max-w-[300px]">
                              {productDetail.descricao}
                            </p>
                          )}
                          <p className="text-[8px] md:text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 md:mt-1">
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
                              <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Posição</th>
                              <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Nível</th>
                              <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Prof.</th>
                              <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Qtd Total</th>
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
                                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.posicao}</span>
                                    </div>
                                    <div className="flex items-center gap-2 pl-9">
                                      <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase">{fmtNum(p.paletes)} PTs</span>
                                      {p.qtd_molhado > 0 && <span className="text-[9px] font-semibold text-blue-500 dark:text-blue-400 uppercase">| {fmtNum(p.qtd_molhado)} M</span>}
                                      {p.qtd_tombada > 0 && <span className="text-[9px] font-semibold text-red-500 dark:text-red-400 uppercase">| {fmtNum(p.qtd_tombada)} T</span>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-center">
                                  <span className="inline-flex h-7 items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-3 text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                                    {p.nivel}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-center">
                                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors">{p.profundidade}</span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 transition-colors">{Math.round(p.quantidade).toLocaleString('pt-BR')}</span>
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
                        className="group flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-semibold text-xs uppercase tracking-widest hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-100 dark:shadow-none"
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
                        <h3 className="text-2xl md:text-5xl font-light text-slate-900 dark:text-white tracking-tighter transition-colors">Palete {selectedPalletId}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                          <div className="flex items-center gap-1.5 transition-colors">
                            <Package size={12} className="text-slate-400 dark:text-slate-500" />
                            <p className="text-[10px] md:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{fmtNum(palletDetail.total_qty)} Peças</p>
                          </div>
                          <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                          <div className="flex items-center gap-1.5 transition-colors">
                            <MapPin size={12} className="text-orange-500" />
                            <p className="text-[10px] md:text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">
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
                            <th className="px-6 py-5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Conteúdo / SKU</th>
                            <th className="px-4 py-5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Local / Coord.</th>
                            <th className="px-4 py-5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Classificação</th>
                            <th className="px-6 py-5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {palletDetail.items.map((item: any, idx: number) => (
                            <tr key={`${item.id ?? item.produto}-${idx}`} className="group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-4">
                                  <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white dark:group-hover:bg-orange-600 dark:group-hover:text-white transition-colors shadow-sm">
                                    <Package size={18} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-base font-semibold text-slate-800 dark:text-slate-200 transition-colors">{item.produto}</span>
                                    {item.descricao && item.descricao !== "-" && (
                                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase truncate max-w-[260px]">
                                        {item.descricao}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-5 text-center whitespace-nowrap">
                                <div className="flex flex-col items-center">
                                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.posicao || "S/P"}</span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    P{item.profundidade ?? "-"} • N{item.nivel ?? "-"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-5 whitespace-nowrap">
                                <select
                                  value={extractRowClassificacao(item)}
                                  disabled={updatingClassificacaoId === String(item.id)}
                                  onChange={(e) => handleUpdateRowClassificacao(item, e.target.value as ClassificacaoPalete)}
                                  className={cn(
                                    "text-[11px] font-semibold rounded-xl px-2.5 py-1.5 border outline-none cursor-pointer transition-colors",
                                    isDevolucao(item)
                                      ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                                      : extractRowClassificacao(item) === "Normal"
                                      ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                      : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                                  )}
                                >
                                  {CLASSIFICACAO_OPTIONS.map(opt => (
                                    <option key={opt.value || 'empty'} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 transition-colors">{fmtNum(item.quantidade_total)}</span>
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
                          Este palete é classificado como <span className="text-orange-400 font-semibold">MISTO</span> por conter {palletDetail.items.length} registros distintos.
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-1">SISTEMA AG-G300 â€¢ AUDITORIA DE PALETES</p>
                      </div>
                    </div>
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
                        <h3 className="text-2xl font-light text-slate-900 dark:text-white tracking-tight">Exportar Relatório</h3>
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1">Configuração de Saída {exportFormat === "pdf" ? "PDF" : "EXCEL"}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowExportConfigModal(false)} className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors border border-slate-100 dark:border-slate-800"><X size={24} /></button>
                  </div>

                  <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex gap-1.5 border border-slate-200 dark:border-slate-800 shadow-inner">
                    <button
                      onClick={() => setExportFormat("excel")}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-2",
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
                        "flex-1 py-3 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-2",
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
                        "flex-1 py-3 text-[10px] font-medium uppercase tracking-widest transition-all relative",
                        exportTab === "simple" ? "text-blue-600" : "text-slate-400 hover:text-slate-500"
                      )}
                    >
                      Seleção Simples
                      {exportTab === "simple" && <motion.div layoutId="exportTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                    </button>
                    <button
                      onClick={() => setExportTab("advanced")}
                      className={cn(
                        "flex-1 py-3 text-[10px] font-medium uppercase tracking-widest transition-all relative",
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
                          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Exportação Completa</h4>
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
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest px-1">1. Categorias de Carga</p>
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
                                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-tight">{opt.label}</span>
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
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest px-1">2. Localização</p>
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
                                <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-tight">{opt.label}</span>
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
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest px-1">3. Status do Saldo</p>
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
                                <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-tight">{opt.label}</span>
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
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest px-1">4. Detalhamento</p>
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
                              <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-tight">Incluir Observações</span>
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
                    <button onClick={() => setShowExportConfigModal(false)} className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95">Cancelar</button>
                    <button onClick={executeProductExport} className="flex-[2] py-3 rounded-2xl bg-blue-600 text-white text-xs font-semibold uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:bg-blue-500 transition-all active:scale-95 flex items-center justify-center gap-2">
                      <Download size={16} /> Gerar {exportFormat === "pdf" ? "PDF" : "Planilha"}
                    </button>
                  </div>

                </motion.div>
              </div>
            )}
          </AnimatePresence>



          <AnimatePresence>
            {selectedPosition && positionDetail && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 transition-colors">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPosition(null)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md" />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-7xl max-h-[96vh] md:max-h-[92vh] rounded-2xl sm:rounded-3xl md:rounded-[3rem] bg-white dark:bg-slate-900 p-2 sm:p-5 md:p-10 shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col overflow-y-auto md:overflow-hidden custom-scrollbar transition-colors">
                  <div className="flex flex-row items-center justify-between gap-2 mb-2 md:mb-8">
                    <div className="flex items-center gap-2 md:gap-4">
                      <div className="h-7 w-7 md:h-14 md:w-14 rounded-xl md:rounded-3xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-200 dark:shadow-blue-900/20 transition-all shrink-0"><MapPin size={14} className="md:w-6 md:h-6" /></div>
                      <div className="text-left">
                        <h3 className="text-sm md:text-3xl font-light text-slate-900 dark:text-white transition-colors leading-tight">{selectedPosition}</h3>
                        <div className="flex items-center gap-2 mt-0 md:mt-1">
                          <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] hidden sm:inline">
                            {fmtNum(positionDetail.occupied)} / {positionDetail.capacidade} Paletes • {Math.round(positionDetail.level_count)} Níveis (0-{Math.round(positionDetail.level_count) - 1})
                          </span>
                          {positionDetail.isOverflow && (
                            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[8px] font-semibold uppercase text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                              <AlertCircle size={8} /> Excesso
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          window.print();
                        }}
                        title="Imprimir Mapa de Mapeamento"
                        className="h-8 w-8 md:h-12 md:px-5 md:w-auto md:px-5 rounded-lg md:rounded-2xl flex items-center justify-center gap-2 transition-all border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <Printer size={14} className="md:w-4 md:h-4" />
                        <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest hidden md:inline">Imprimir Mapa</span>
                      </button>

                      {!!user && (
                        <button
                          onClick={() => {
                            const event = new CustomEvent("trigger-drivein-edit");
                            window.dispatchEvent(event);
                          }}
                          title="Editar Posição"
                          className="h-8 px-2.5 md:h-12 md:px-5 rounded-lg md:rounded-2xl flex items-center justify-center gap-2 transition-all border bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800 cursor-pointer"
                        >
                          <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest">Editar</span>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedPosition(null)}
                        className="h-8 w-8 md:h-12 md:w-12 rounded-lg md:rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-all border border-slate-100 dark:border-slate-800"
                      >
                        <X size={16} className="md:w-6 md:h-6" />
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
                      availableStocks={effectiveDivergences}
                      mapeamentoData={effectiveData}
                      pendingChanges={pendingChanges}
                      setPendingChanges={setPendingChanges}
                    />
                  </div>




                  {positionDetail.isOverflow && (
                    <div className="mt-4 p-5 rounded-[2rem] bg-red-600 text-white flex items-center gap-4 shadow-xl shadow-red-500/20 border border-red-500/50 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <AlertCircle size={24} className="animate-pulse shrink-0" />
                      <div className="text-left">
                        <p className="text-[11px] font-semibold uppercase tracking-tight">ALERTA DE CAPACIDADE EXCEDIDA</p>
                        <p className="text-[10px] font-medium text-red-100 leading-tight">
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
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">
                          Produtos em Sobra
                        </h3>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">
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
                        <div className="grid grid-cols-[1fr_repeat(3,_auto)] gap-4 px-4 py-2 text-[9px] font-semibold uppercase text-slate-400 tracking-widest border-b border-slate-50 dark:border-slate-800/50">
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
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                              {item.sku}
                            </span>
                            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 text-right w-16">
                              {fmtNum(item.mapQty)}
                            </span>
                            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 text-right w-16">
                              {fmtNum(item.regQty)}
                            </span>
                            <div className="flex flex-col items-end w-16">
                              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
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
            !devolucaoPrintPayload && isExportingPDF && printData.length > 0 && (
              <div className="hidden print:block relative bg-white min-h-screen w-full text-black font-sans leading-tight p-6">

                {/* Header Corporativo Ultra Compacto */}
                <div className="border-b-[1.5px] border-black pb-2 mb-4 flex justify-between items-end">
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-black/50 mb-0.5">Auditoria Logística G300</p>
                    <h1 className="text-xl font-semibold uppercase tracking-tight leading-none mb-1">Relação de Produtos e Divergências</h1>
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
                    <span className="text-sm font-semibold">{printData.length}</span>
                  </div>
                  <div className="px-3 py-2 border border-black flex items-center justify-between">
                    <span className="text-[7px] font-bold uppercase text-black/60 tracking-wider">Peças Físicas G300:</span>
                    <span className="text-sm font-semibold">{printData.reduce((acc, curr) => acc + curr.quantidade_total, 0).toLocaleString('pt-BR')}</span>
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
                        <td className="px-3 py-1.5 text-right font-semibold">{item.quantidade_total.toLocaleString('pt-BR')}</td>
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
                        <h2 className="text-2xl font-light dark:text-slate-100 text-slate-800 tracking-tight">Criar Palete Misto</h2>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">Consolidação de {selectedNaoAlocados.size} Itens</p>
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
                      <label className="text-[10px] font-medium uppercase tracking-widest text-slate-500 ml-1">Identificação do Palete</label>
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
                          className="w-full h-16 pl-14 pr-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-semibold placeholder:font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all uppercase"
                        />
                      </div>
                      <div className="flex items-center gap-2 px-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Sistema gera ID sequencial (P.001) automático se vazio</p>
                      </div>
                    </div>
                    
                    <button 
                      type="submit"
                      disabled={isProcessingGroup || selectedNaoAlocados.size === 0}
                      className="w-full h-16 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
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
                  
                  <h3 className="text-2xl font-light text-slate-900 dark:text-white mb-3">Desagrupar Palete?</h3>
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
                      className="w-full h-14 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                    >
                      Sim, Desagrupar
                    </button>
                    
                    <button 
                      onClick={() => setShowUngroupConfirm(false)}
                      className="w-full h-14 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] text-slate-600 dark:text-slate-300 font-semibold rounded-2xl transition-all"
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
                    <h3 className="text-2xl font-light text-slate-800 dark:text-white tracking-tight">Área Restrita</h3>
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
                    <label className="text-[10px] font-medium uppercase tracking-widest text-slate-500 ml-1">E-mail Corporativo</label>
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
                    <label className="text-[10px] font-medium uppercase tracking-widest text-slate-500 ml-1">Senha de Acesso</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-2 py-1">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="rememberMe" className="text-xs font-normal text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                      Lembrar meu e-mail
                    </label>
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
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-widest">
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
                
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 text-center uppercase tracking-tight mb-2">
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
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Produto</span>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest text-right">Max</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700 dark:text-line-200 truncate pr-4">{transferPayload.sourceItem.produto || "Desconhecido"}</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {transferPayload.sourceItem.quantidade_total}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest ml-1">Quantidade a Mover</label>
                  <input
                    type="number"
                    value={transferQuantity}
                    onChange={(e) => setTransferQuantity(e.target.value)}
                    max={transferPayload.sourceItem.quantidade_total}
                    className="w-full h-14 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center text-xl font-semibold text-slate-800 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    disabled={isTransferring}
                    onClick={() => { setTransferModalOpen(false); setTransferPayload(null); setDraggedItem(null); }}
                    className="flex-1 py-4 text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    CANCELAR
                  </button>
                  <button
                    disabled={isTransferring}
                    onClick={handleConfirmTransfer}
                    className="flex-[2] py-4 text-xs font-semibold text-white bg-blue-600 dark:bg-blue-500 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
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
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 text-center uppercase tracking-tight mb-1">Retirar peças</h3>
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mb-5">
                    Retirar peças de <span className="font-semibold text-slate-700 dark:text-slate-200">{splitTarget.produto}</span> ({total} un.) para enviar pro chão.
                  </p>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-4 space-y-2">
                    <div className="flex justify-between text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                      <span>Total do palete</span>
                      <span className="text-slate-700 dark:text-slate-300">{total} un.</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest ml-1">Quantidade a retirar</label>
                    <input
                      type="number"
                      min={1}
                      max={total - 1}
                      value={splitQtyPerPallet}
                      onChange={e => setSplitQtyPerPallet(e.target.value)}
                      placeholder="ex: 10"
                      className="w-full h-14 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center text-xl font-semibold text-slate-800 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>

                  {isValid && (
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-3 mb-5">
                      <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Resultado</p>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Nova Quantidade (Palete):</span>
                          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 ml-auto">{remaining} un.</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">1 Novo Palete criado com:</span>
                          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 ml-auto">{extractedQty} un.</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button disabled={isSplitting} onClick={() => { setSplitModalOpen(false); setSplitTarget(null); setSplitQtyPerPallet("") }}
                      className="flex-1 py-4 text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                      CANCELAR
                    </button>
                    <button disabled={isSplitting || !isValid} onClick={handleSplitPallets}
                      className="flex-[2] py-4 text-xs font-semibold text-white bg-blue-600 dark:bg-blue-500 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
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
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 text-center uppercase tracking-tight mb-1">Mover Peças</h3>
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mb-5 leading-tight">
                    Os <span className="font-semibold text-slate-700 dark:text-slate-200">{itemsToRender.length} paletes</span> selecionados do <span className="font-semibold text-emerald-600 dark:text-emerald-400">{mergeTarget.sku}</span>.<br />
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
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-right font-semibold text-slate-700 dark:text-slate-300 w-24 outline-none focus:border-emerald-500 text-sm"
                          />
                        </div>
                      )
                    })}
                    <div className="flex justify-between items-center text-xs pt-3 mt-1 border-t border-slate-200 dark:border-slate-700 font-semibold">
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
                         className="w-full py-4 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-40 flex flex-col items-center justify-center gap-1.5 shadow-sm">
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
                        className="flex-1 py-3 text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        CANCELAR
                      </button>
                      <button disabled={isMerging || !isValidGroup} onClick={() => handleMergeBySku(false)}
                        className="flex-[2] py-3 text-xs font-semibold text-white bg-emerald-600 dark:bg-emerald-500 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
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
                
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 text-center uppercase tracking-tight mb-2">
                  Confirmar Exclusão
                </h3>
                
                <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6 px-4">
                  Deseja excluir as unidades deste registro do sistema? <b>Essa ação não pode ser desfeita.</b>
                </p>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Produto</span>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest text-right">Max</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate pr-4">{deleteTarget.produto || "Desconhecido"}</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      {deleteTarget.quantidade_total}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest ml-1">Quantidade a Excluir</label>
                  <input
                    type="number"
                    value={deleteQuantity}
                    onChange={(e) => setDeleteQuantity(e.target.value)}
                    max={deleteTarget.quantidade_total}
                    className="w-full h-14 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center text-xl font-semibold text-slate-800 dark:text-white focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                  />
                  <div className="flex justify-between mt-2 px-1">
                     <span className="text-[10px] text-slate-400">Excluir tudo?</span>
                     <button
                        onClick={() => setDeleteQuantity(String(deleteTarget.quantidade_total || "0"))} 
                        className="text-[10px] font-semibold text-red-500 uppercase tracking-widest hover:underline"
                     >
                        Preencher ALL
                     </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    disabled={isDeleting}
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-4 text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    CANCELAR
                  </button>
                  <button
                    disabled={isDeleting}
                    onClick={executeDeleteFromChao}
                    className="flex-[2] py-4 text-xs font-semibold text-white bg-red-600 dark:bg-red-500 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50"
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
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Novo Item</h3>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Adicionar ao Chão (Sem Alocação)</p>
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
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">SKU (Código) *</label>
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
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Quantidade (Inteira) *</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="Somente números inteiros"
                      value={newItemData.quantidade}
                      onChange={(e) => setNewItemData(prev => ({ ...prev, quantidade: e.target.value }))}
                      className="w-full h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold text-slate-700 dark:text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>

                  {/* Classificação individual da linha */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Classificação</label>
                    <select
                      value={newItemData.classificacao}
                      onChange={(e) => setNewItemData(prev => ({ ...prev, classificacao: e.target.value as ClassificacaoPalete }))}
                      className={cn(
                        "w-full h-12 bg-slate-50 dark:bg-slate-800/50 border rounded-xl px-4 text-sm font-bold outline-none transition-all",
                        newItemData.classificacao === "Devolução"
                          ? "border-amber-500 text-amber-600 dark:text-amber-400"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white focus:border-blue-500"
                      )}
                    >
                      {CLASSIFICACAO_OPTIONS.map(opt => (
                        <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Observação */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Observação</label>
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
                    className="flex-1 py-4 text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    CANCELAR
                  </button>
                  <button
                    disabled={isCreatingItem}
                    onClick={handleCreateNewItem}
                    className="flex-[2] py-4 text-xs font-semibold text-white bg-blue-600 dark:bg-blue-500 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
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

      {/* Modal de Cadastrar Produto na Tabela base_codigos */}
      <AnimatePresence>
        {showAddBaseCodigoModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddBaseCodigoModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden z-10"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-none">Cadastrar Produto</h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-1">Adicionar SKU à tabela base_codigos</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddBaseCodigoModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newBaseCodigoData.codigo.trim() || !newBaseCodigoData.descricao.trim()) {
                    alert("Código e Descrição são obrigatórios!");
                    return;
                  }
                  setIsSavingBaseCodigo(true);
                  try {
                    const payload = {
                      "Código": newBaseCodigoData.codigo.trim().toUpperCase(),
                      "Descrição": newBaseCodigoData.descricao.trim().toUpperCase(),
                      "Grade": newBaseCodigoData.grade.trim() || null,
                      "Tipo": newBaseCodigoData.tipo.trim() || null
                    };
                    const { error } = await supabase.from('base_codigos').insert([payload]);
                    if (error) {
                      alert("Erro ao cadastrar produto: " + error.message);
                    } else {
                      alert("Produto cadastrado com sucesso na tabela base_codigos!");
                      setShowAddBaseCodigoModal(false);
                      setNewBaseCodigoData({ codigo: '', descricao: '', grade: '', tipo: '' });
                      fetchData();
                    }
                  } catch (err: any) {
                    alert("Erro inesperado: " + err.message);
                  } finally {
                    setIsSavingBaseCodigo(false);
                  }
                }}
                className="space-y-4 pt-4"
              >
                <div>
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block mb-1">Código (SKU) *</label>
                  <input
                    type="text"
                    required
                    value={newBaseCodigoData.codigo}
                    onChange={e => setNewBaseCodigoData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                    placeholder="Ex: 0190-01"
                    className="w-full h-10 px-3 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block mb-1">Descrição *</label>
                  <input
                    type="text"
                    required
                    value={newBaseCodigoData.descricao}
                    onChange={e => setNewBaseCodigoData(prev => ({ ...prev, descricao: e.target.value.toUpperCase() }))}
                    placeholder="Ex: ESPREMEDOR E-01 127V/60HZ TURBO"
                    className="w-full h-10 px-3 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block mb-1">Grade (Opcional)</label>
                    <input
                      type="text"
                      value={newBaseCodigoData.grade}
                      onChange={e => setNewBaseCodigoData(prev => ({ ...prev, grade: e.target.value }))}
                      placeholder="Ex: 36"
                      className="w-full h-10 px-3 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block mb-1">Tipo (Opcional)</label>
                    <input
                      type="text"
                      value={newBaseCodigoData.tipo}
                      onChange={e => setNewBaseCodigoData(prev => ({ ...prev, tipo: e.target.value }))}
                      placeholder="Ex: ELETRO"
                      className="w-full h-10 px-3 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isSavingBaseCodigo}
                    onClick={() => setShowAddBaseCodigoModal(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium uppercase transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBaseCodigo}
                    className="flex-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium uppercase shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingBaseCodigo ? "Salvando..." : "Cadastrar Produto"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Floating Save Changes Indicator */}
      <AnimatePresence>
        {pendingChanges.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] w-full max-w-xl px-4"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-6 backdrop-blur-xl bg-white/90 dark:bg-slate-900/90">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <RefreshCw className={cn("w-6 h-6", isCommitting && "animate-spin")} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white uppercase leading-none mb-1">Alterações Pendentes</p>
                  <p className="text-xs font-normal text-slate-500 uppercase tracking-wider">
                    {pendingChanges.length} {pendingChanges.length === 1 ? 'modificação a ser salva' : 'modificações a serem salvas'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (window.confirm("Deseja descartar todas as alterações não salvas?")) {
                      setPendingChanges([])
                    }
                  }}
                  className="px-4 py-3 rounded-xl text-[10px] font-semibold uppercase text-slate-400 hover:text-rose-500 transition-colors"
                  disabled={isCommitting}
                >
                  Descartar
                </button>
                <button
                  onClick={commitChanges}
                  disabled={isCommitting}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold uppercase shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCommitting ? (
                    <>Salvando...</>
                  ) : (
                    <>
                      <Check size={16} /> Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Module Switcher Modal ── */}
      <AnimatePresence>
        {showModuleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backdropFilter: 'blur(16px)', background: 'rgba(2,6,23,0.7)' }}
            onClick={() => setShowModuleModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-8 pt-8 pb-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-4">
                  <Repeat2 size={22} className="text-white/70" />
                </div>
                <h2 className="text-lg font-semibold text-white tracking-tight">Selecionar Módulo</h2>
                <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-widest">Avarias — Escolha o portal</p>
              </div>

              {/* Cards */}
              <div className="px-6 pb-8 grid grid-cols-2 gap-4">
                {/* AG Card — active */}
                <div
                  className="relative rounded-2xl p-5 cursor-default flex flex-col items-center gap-3 border-2 border-blue-500/60 bg-blue-500/10"
                >
                  <div className="absolute top-3 right-3">
                    <span className="text-[9px] font-semibold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Ativo</span>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-blue-600 shadow-xl shadow-blue-500/40">
                    <Package size={28} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white leading-tight">Portal <span className="text-blue-400">AG</span></p>
                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.18em] mt-0.5">G300 PAINEL<br/>OPERACIONAL</p>
                  </div>
                </div>

                {/* BR Card — navigate */}
                <button
                  onClick={() => { setShowModuleModal(false); window.location.href = '/br'; }}
                  className="relative rounded-2xl p-5 flex flex-col items-center gap-3 border-2 border-transparent hover:border-emerald-500/60 bg-white/5 hover:bg-emerald-500/10 transition-all duration-200 group"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-emerald-600 group-hover:bg-emerald-500 shadow-xl shadow-emerald-500/30 transition-colors">
                      <Fan size={28} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white leading-tight">Portal <span className="text-emerald-400">BR</span></p>
                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.18em] mt-0.5">MKBR E G300</p>
                  </div>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">Acessar →</span>
                </button>
              </div>

              {/* Close */}
              <button
                onClick={() => setShowModuleModal(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* MODAL BLOQUEANTE DE ERRO CRÍTICO / ATOMICIDADE */}
        {blockingError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border-2 border-red-500/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl shadow-red-500/20 text-white relative flex flex-col gap-4"
            >
              <div className="flex items-center gap-3 text-red-400 border-b border-red-500/30 pb-3">
                <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0 animate-bounce" />
                <div>
                  <h3 className="text-lg font-bold text-red-400 uppercase tracking-wide">
                    Erro Crítico de Operação
                  </h3>
                  <p className="text-xs text-slate-400">Atomicidade Garantida — Ação Interrompida</p>
                </div>
              </div>

              <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 text-sm font-mono text-red-200 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                {blockingError}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Nenhuma alteração foi gravada em metade no servidor. Todas as ações nesta transação foram revertidas para manter a integridade dos dados.
              </p>

              <button
                onClick={() => setBlockingError(null)}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/30 hover:shadow-red-500/50 flex items-center justify-center gap-2"
              >
                Ciente / Entendi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DashboardPage;

