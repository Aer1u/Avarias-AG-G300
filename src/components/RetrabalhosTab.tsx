"use client"

import React, { useState, useEffect, useMemo } from "react"
import ReactDOM from "react-dom"

import { 
  Truck,
  Search, 
  ChevronDown,
  Package,
  CheckCircle2,
  AlertCircle,
  Layers,
  Hash,
  Box,
  TrendingUp,
  Clock,
  ChevronRight,
  Sparkles,
  PauseCircle,
  PlayCircle,
  ListTodo,
  Hourglass,
  Plus,
  RefreshCw,
  ArrowRight,
  ListMusic,
  X,
  Calendar,
  Save,
  Check,
  Edit3,
  Database,
  Info,
  ArrowRightLeft,
  ListFilter,
  Repeat,
  Filter,
  Printer,
  QrCode,
  CheckSquare,
  Hammer,
  Warehouse,
  PackageCheck,
  BarChart3,
  Activity,
  FileText,
  ExternalLink,
  ChevronUp,
  Table,
  Clipboard,
  Trash2
} from "lucide-react"

const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    .no-spinner::-webkit-inner-spin-button,
    .no-spinner::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .no-spinner {
      -moz-appearance: textfield;
    }
    .custom-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .custom-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `}} />
)

import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

interface RetrabalhoRecord {
  id: number
  lote: any
  quantidade_enviada: number
  data_inicio: string | null
  data_fim: string | null
  quantidade_retornada: number
  reserva_a501: string
  reserva_g501: string
  estorno_a501: string
  estorno_g501: string
  quantidade_rejeitada: number
  status: string
  embalagens_avariadas: number
  codigo?: string
  desc_produto?: string
  cliente?: string
  unidade?: string
  situacao?: string | null
  Sistema?: boolean
  enviado_ao_cd?: string | null
  enviado_ao_conserto?: string | null
  enviado_ao_g300?: string | null
  armazenado?: string | null
  numero_da_viagem?: number | null
  turno_da_viagem?: number | null
  created_at?: string | null
}

interface LoteConfig {
  lote: any
  codigo: string
  status?: string
  Status?: string 
  embalagens?: number
}

interface BaseCodigo {
  "Código": string
  "Descrição": string
  "Grade"?: string | number
}

interface GroupedLote {
  lote: number
  displayId?: string
  codigo: string
  descricao: string
  grade: number
  totalEmbalagens: number
  totalEnviado: number
  totalRetornado: number
  totalRejeitado: number
  totalAvarias: number
  items: RetrabalhoRecord[]
  status: string
  progresso: number
}

const STATUS_OPTIONS = [
  { id: 'all', label: 'Todos', icon: Layers, color: 'text-slate-400' },
  { id: 'Aguardando', label: 'Aguardando', icon: Hourglass, color: 'text-amber-400' },
  { id: 'EM ANDAMENTO', label: 'Em andamento', icon: PlayCircle, color: 'text-blue-400' },
  { id: 'PAUSADO', label: 'Pausado', icon: PauseCircle, color: 'text-rose-400' },
  { id: 'FINALIZADO', label: 'Finalizado', icon: CheckCircle2, color: 'text-emerald-400' },
  { id: 'EM FILA', label: 'Em Fila', icon: ListMusic, color: 'text-purple-400' },
]

const SITUACAO_OPTIONS = [
  { value: 'Em preparação', label: 'Em preparação', color: 'bg-slate-400' },
  { value: 'Pendentes', label: 'Pendentes', color: 'bg-amber-400' },
  { value: 'Entregues ao conserto', label: 'No Conserto', color: 'bg-purple-400' },
  { value: 'Entregues ao CD', label: 'No CD', color: 'bg-blue-400' },
  { value: 'Retornado ao G300', label: 'Retornado ao G300', color: 'bg-indigo-400' },
  { value: 'Armazenado', label: 'Armazenado', color: 'bg-emerald-500' },
]

const CompactList = ({ text, colorClass = "text-white" }: { text: string | null | undefined, colorClass?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  
  if (!text || text === '---') return <span className="text-slate-600 font-mono text-[11px]">---</span>;
  
  const items = text.split(/[\s\n,]+/).filter(Boolean);
  
  if (items.length <= 1) {
    return (
      <div className="overflow-hidden w-full">
        <span className={cn("text-[12px] font-bold font-mono truncate block", colorClass)} title={text || ''}>
          {text}
        </span>
      </div>
    );
  }

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }
    setExpanded(true);
  };

  const tooltip = expanded ? (
    <div
      style={{
        position: 'fixed',
        top: pos.top - window.scrollY,
        left: pos.left,
        transform: 'translateX(-50%)',
        zIndex: 999999,
        pointerEvents: 'none',
      }}
    >
      <div className="w-max min-w-[140px] max-w-[250px] p-1.5 bg-[#111827] border border-white/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
        <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
          {items.map((item, i) => (
            <div key={`${item}-${i}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono w-4 text-right select-none">{i + 1}.</span>
              <span className={cn("text-[12px] font-bold font-mono tracking-wider", colorClass.replace(/\/50|\/90/, ''))}>
                {item}
              </span>
            </div>
          ))}
        </div>
        {/* Arrow */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px border-[6px] border-transparent border-b-white/20">
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-b-[#111827]" />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative inline-flex items-center" onMouseLeave={() => setExpanded(false)}>
      <div 
        ref={triggerRef}
        className={cn("px-2 py-1 rounded-md border border-white/10 bg-white/[0.03] inline-flex items-center justify-center cursor-pointer hover:bg-white/[0.08] transition-all", colorClass, expanded && "bg-white/[0.08] border-white/20")}
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        onMouseEnter={handleMouseEnter}
      >
        <span className="text-[9px] font-black tracking-widest">{items.length} ITENS</span>
      </div>

      {typeof window !== 'undefined' && expanded && 
        ReactDOM.createPortal(tooltip, document.body)
      }
    </div>
  );
};


export default function RetrabalhosTab({ refreshTrigger }: { refreshTrigger?: boolean } = {}) {
  const [records, setRecords] = useState<RetrabalhoRecord[]>([])
  const [lotesConfig, setLotesConfig] = useState<LoteConfig[]>([])
  const [baseCodigos, setBaseCodigos] = useState<BaseCodigo[]>([])
  const [registrosData, setRegistrosData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [modalSearch, setModalSearch] = useState("")
  const [activeStatus, setActiveStatus] = useState("all")
  const [activeSituacao, setActiveSituacao] = useState("all")
  const [expandedLotes, setExpandedLotes] = useState<Set<number>>(new Set())
  const [user, setUser] = useState<any>(null)
  const [isNewLoteModalOpen, setIsNewLoteModalOpen] = useState(false)
  const [isNewReservaModalOpen, setIsNewReservaModalOpen] = useState(false)
  const [selectedLoteForReserva, setSelectedLoteForReserva] = useState<number | null>(null)
  const [editingReserva, setEditingReserva] = useState<RetrabalhoRecord | null>(null)
  const [docRows, setDocRows] = useState<{ a501: string, g501: string }[]>(
    Array.from({ length: 15 }, () => ({ a501: '', g501: '' }))
  )

  const [editingLote, setEditingLote] = useState<GroupedLote | null>(null)
  const [selectedLoteDetail, setSelectedLoteDetail] = useState<GroupedLote | null>(null)
  const [tempStatus, setTempStatus] = useState<string>("")
  const [tempSituacao, setTempSituacao] = useState<string>("")
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [isSituacaoOpen, setIsSituacaoOpen] = useState(false)
  const [modalSituacaoFilter, setModalSituacaoFilter] = useState("all")
  const [selectedReservas, setSelectedReservas] = useState<Set<number>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [expandedViagens, setExpandedViagens] = useState<string | null>(null)

  const [isViagemModalOpen, setIsViagemModalOpen] = useState(false)
  const [editingViagemGroup, setEditingViagemGroup] = useState<{ number: string, items: RetrabalhoRecord[] } | null>(null)
  const [excelRows, setExcelRows] = useState<{ a501: string, g501: string, qtd: string }[]>(
    Array.from({ length: 20 }, () => ({ a501: '', g501: '', qtd: '' }))
  )

  // Scanner States
  const [scanBuffer, setScanBuffer] = useState("")
  const [lastScanTime, setLastScanTime] = useState(0)
  const [scanToast, setScanToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({
    show: false,
    message: "",
    type: 'success'
  })



  const toggleViagem = (viagem: string) => {
    setExpandedViagens(prev => prev === viagem ? null : viagem);
  };


const handlePrintQR = () => {
  if (!selectedLoteDetail) return;
  const selectedItems = selectedLoteDetail.items.filter(item => selectedReservas.has(item.id));
  if (selectedItems.length === 0) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const content = selectedItems.map(item => {
    const reservaA = item.reserva_a501 || '---';
    const reservaG = item.reserva_g501 || '---';
    const viagemNum = item.numero_da_viagem || '---';
    const loteNum = item.lote || '---';
    const sku = selectedLoteDetail.codigo || '---';
    const desc = selectedLoteDetail.descricao || '---';
    const qtd = item.quantidade_enviada || 0;

    const qrUrlA = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(reservaA)}`;
    const qrUrlG = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(reservaG)}`;
    
    // URL dinâmica para a página de confirmação
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const qrActivate = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(baseUrl + '/confirmar?id=' + item.id)}`;

    const renderCard = (title: string, resNum: string, qrUrl: string) => `
      <div style="border: 2px solid #000; width: 500px; padding: 20px; text-align: center; border-radius: 12px; background: white; margin-bottom: 20px;">
        <h2 style="margin: 0 0 10px 0; font-size: 18px; text-transform: uppercase; font-weight: 900; color: #000; border-bottom: 2px solid #000; padding-bottom: 5px;">${title}</h2>
        <div style="display: flex; align-items: center; gap: 20px; margin-top: 10px; text-align: left;">
          <img src="${qrUrl}" style="width: 150px; height: 150px;" />
          <div style="flex: 1;">
            <div style="font-size: 26px; font-weight: 900; color: #000; margin-bottom: 8px; font-family: monospace;">${resNum}</div>
            <div style="margin-bottom: 4px; font-size: 13px;"><strong>CÓD:</strong> ${sku}</div>
            <div style="margin-bottom: 4px; font-size: 11px; color: #444; line-height: 1.2;">${desc}</div>
            <div style="margin-bottom: 4px; font-size: 13px;"><strong>QTD:</strong> ${qtd}</div>
          </div>
        </div>
      </div>
    `;

    return `
      <div style="page-break-after: always; display: flex; flex-direction: column; align-items: center; padding: 30px; font-family: 'Inter', -apple-system, sans-serif; min-height: 95vh; box-sizing: border-box;">
        
        <!-- TOPO DA PÁGINA: Informações da Viagem -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 4px solid #000; padding-bottom: 15px; width: 100%; max-width: 550px;">
          <div style="font-size: 42px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: -1px;">VIAGEM #${viagemNum} - G300</div>
          <div style="font-size: 14px; font-weight: 800; color: #444; text-transform: uppercase; margin-top: 5px; letter-spacing: 1px;">
            LOTE #${loteNum} &nbsp; | &nbsp; CÓDIGO: ${sku}
          </div>
        </div>

        <!-- MEIO: Cards de Reserva -->
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 10px;">
           ${renderCard('RESERVA A501', reservaA, qrUrlA)}
           ${renderCard('RESERVA G501', reservaG, qrUrlG)}
        </div>

      </div>
    `;
  }).join('');

  const html = '<html>' +
  '<head>' +
    '<title>Imprimir Etiquetas - G300</title>' +
    '<style>' +
      '@page { size: A4; margin: 0; }' +
      'body { margin: 0; padding: 0; background: #fff; }' +
      '@media print {' +
        '.no-print { display: none; }' +
        'body { -webkit-print-color-adjust: exact; }' +
      '}' +
    '</style>' +
  '</head>' +
  '<body onload="setTimeout(() => { window.print(); window.close(); }, 500);">' +
    content +
  '</body>' +
'</html>';

printWindow.document.write(html);
printWindow.document.close();
};
    
  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)

      const [retrabalhosRes, lotesRes, baseRes, registrosRes] = await Promise.all([
        supabase.from('retrabalhos').select('*'),
        supabase.from('lotes_config').select('*'),
        supabase.from('base_codigos').select('*'),
        supabase.from('Registros').select('Entrada, Saída')
      ])
      setRecords(retrabalhosRes.data || [])
      setLotesConfig(lotesRes.data || [])
      setBaseCodigos(baseRes.data || [])
      setRegistrosData(registrosRes.data || [])
    } catch (err) {
      console.error("Erro na busca:", err)
    } finally {
      setTimeout(() => setLoading(false), 400)
    }
  }

  useEffect(() => {
    fetchData()
    
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    // Realtime subscription for automatic updates
    const channel = supabase
      .channel('retrabalhos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'retrabalhos' },
        (payload) => {
          console.log('Realtime update received:', payload);
          // If it's an update, we can update the specific record in state
          if (payload.eventType === 'UPDATE') {
            setRecords(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
          } else {
            // For other events (INSERT, DELETE), refetch everything to be safe
            fetchData();
          }
        }
      )
      .subscribe();

    return () => {
      authSub.unsubscribe();
      supabase.removeChannel(channel);
    }
  }, [])

  useEffect(() => {
    if (editingReserva) {
      setTempStatus(editingReserva.status?.toUpperCase() || "AGUARDANDO");
      setTempSituacao(editingReserva.situacao || "Em preparação");
    }
  }, [editingReserva])

  useEffect(() => {
    if (refreshTrigger) {
      fetchData()
    }
  }, [refreshTrigger])

  // Global Scanner Listener
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignorar se for apenas teclas de modificação
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

      const now = Date.now()
      const timeDiff = now - lastScanTime
      
      // Se demorar muito entre teclas, provavelmente é digitação manual
      // Mas se o prefixo já estiver lá, continuamos aceitando (caso o scanner seja lento)
      if (timeDiff > 100 && !scanBuffer.startsWith("SISTEMA_")) {
        setScanBuffer(e.key === "Enter" ? "" : e.key)
      } else {
        if (e.key === "Enter") {
          // Detectar link de confirmação ou prefixo direto
          if (scanBuffer.includes("/confirmar?id=")) {
            const parts = scanBuffer.split("id=")
            const itemId = parts[parts.length - 1].trim()
            if (itemId) await handleAutomatedScan(itemId)
          } else if (scanBuffer.startsWith("SISTEMA_")) {
            const itemId = scanBuffer.replace("SISTEMA_", "").trim()
            if (itemId) {
              await handleAutomatedScan(itemId)
            }
          }
          setScanBuffer("")
        } else {
          if (e.key.length === 1) {
            setScanBuffer(prev => prev + e.key)
          }
        }
      }
      setLastScanTime(now)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [scanBuffer, lastScanTime])

  const handleAutomatedScan = async (id: string) => {
    try {
      const now = new Date();
      const isoDate = now.toISOString().split('T')[0];

      const { error } = await supabase
        .from('retrabalhos')
        .update({ 
          Sistema: true,
          situacao: 'Entregues ao conserto',
          enviado_ao_conserto: isoDate
        })
        .eq('id', Number(id))

      if (error) throw error

      setScanToast({
        show: true,
        message: `ENTREGA CONFIRMADA (#${id})`,
        type: 'success'
      })
      
      fetchData()
      
      setTimeout(() => setScanToast(prev => ({ ...prev, show: false })), 3000)
    } catch (err) {
      console.error("Erro no scanner:", err)
      setScanToast({
        show: true,
        message: `ERRO AO ATUALIZAR ITEM #${id}`,
        type: 'error'
      })
      setTimeout(() => setScanToast(prev => ({ ...prev, show: false })), 4000)
    }
  }

  // Sync selectedLoteDetail whenever records change (after optimistic updates)
useEffect(() => {
  if (!selectedLoteDetail) return;

  const loteId = selectedLoteDetail.lote;
  const loteItems = records.filter(r => Number(String(r.lote).trim()) === loteId);
  if (loteItems.length === 0) return;

  // Só atualiza se algo realmente mudou
  const itemsChanged = loteItems.some(newItem => {
    const oldItem = selectedLoteDetail.items.find(i => i.id === newItem.id);
    return !oldItem || JSON.stringify(oldItem) !== JSON.stringify(newItem);
  });

  if (!itemsChanged) return;

  const config = lotesConfig.find(c => String(c.lote).trim() === String(loteId).trim());
  const embalagensMaster = config?.embalagens || selectedLoteDetail.totalEmbalagens;

  let totalEnviado = 0, totalRetornado = 0, totalRejeitado = 0, totalAvarias = 0;
  loteItems.forEach(item => {
    const sit = (item.situacao || '').toLowerCase();
    if (['entregues ao conserto', 'entregues ao cd', 'armazenado', 'retornado ao g300'].includes(sit)) {
      totalEnviado += item.quantidade_enviada || 0;
    }
    totalRetornado += item.quantidade_retornada || 0;
    totalRejeitado += item.quantidade_rejeitada || 0;
    totalAvarias += item.embalagens_avariadas || 0;
  });

  setSelectedLoteDetail(prev => prev ? ({
    ...prev,
    totalEmbalagens: embalagensMaster,
    totalEnviado,
    totalRetornado,
    totalRejeitado,
    totalAvarias,
    progresso: Math.min(100, (totalRetornado / (totalEnviado || 1)) * 100),
    items: [...loteItems].sort((a, b) => {
      const dA = a.data_inicio ? new Date(a.data_inicio).getTime() : 0;
      const dB = b.data_inicio ? new Date(b.data_inicio).getTime() : 0;
      return dA - dB;
    })
  }) : null);
}, [records, lotesConfig]);

  const groupedData = useMemo(() => {
if (activeStatus?.toUpperCase() === 'EM FILA') {
  // Lotes de retrabalhos com status EM FILA
  const fromRecords = records.filter(item => {
    const itemStatus = (item.status || "Aguardando").trim().toUpperCase()
    const matchesSearch = item.codigo?.toLowerCase().includes(search.toLowerCase()) ||
                         item.desc_produto?.toLowerCase().includes(search.toLowerCase()) ||
                         item.lote?.toString().includes(search)
    return (itemStatus === 'EM FILA' || itemStatus === 'FILA') && matchesSearch
  }).map(item => {
    const config = lotesConfig.find(c => String(c.lote).trim() === String(item.lote).trim())
    const cleanCodigo = (item.codigo || config?.codigo || '---').trim();
    const base = baseCodigos.find(b => String(b["Código"]).trim() === cleanCodigo);
    return {
      lote: item.lote,
      displayId: `FILA-${item.id}`,
      status: item.status || 'EM FILA',
      codigo: cleanCodigo,
      descricao: item.desc_produto || base?.["Descrição"] || `Produto ${cleanCodigo}`,
      grade: base?.["Grade"] ? Number(base["Grade"]) : 0,
      totalEmbalagens: item.quantidade_enviada || 0,
      totalEnviado: item.quantidade_enviada || 0,
      totalRetornado: item.quantidade_retornada || 0,
      totalRejeitado: item.quantidade_rejeitada || 0,
      totalAvarias: item.embalagens_avariadas || 0,
      progresso: item.quantidade_enviada > 0 ? (item.quantidade_retornada / item.quantidade_enviada) * 100 : 0,
      items: [item]
    }
  })

  // Lotes de lotes_config com status Em fila mas sem records ainda
  const fromConfig = lotesConfig
    .filter(config => {
      const s = (config.status || config.Status || '').trim().toUpperCase()
      if (s !== 'EM FILA' && s !== 'FILA') return false
      const loteId = Number(String(config.lote).trim())
      const alreadyInRecords = fromRecords.some(r => r.lote === loteId)
      if (alreadyInRecords) return false
      const matchesSearch = !search ||
        config.codigo?.toLowerCase().includes(search.toLowerCase()) ||
        String(config.lote).includes(search)
      return matchesSearch
    })
    .map(config => {
      const loteId = Number(String(config.lote).trim())
      const codigo = config.codigo || '---'
      const base = baseCodigos.find(b => String(b["Código"]).trim() === codigo)
      return {
        lote: loteId,
        displayId: `FILA-CONFIG-${loteId}`,
        status: 'EM FILA',
        codigo,
        descricao: base?.["Descrição"] || `Produto ${codigo}`,
        grade: base?.["Grade"] ? Number(base["Grade"]) : 0,
        totalEmbalagens: config.embalagens || 0,
        totalEnviado: 0,
        totalRetornado: 0,
        totalRejeitado: 0,
        totalAvarias: 0,
        progresso: 0,
        items: []
      }
    })

  return [...fromRecords, ...fromConfig].sort((a, b) => a.lote - b.lote)
}

    const groups: { [key: number]: GroupedLote } = {}
    records.forEach(item => {
      const loteIdRaw = String(item.lote).trim()
      const loteId = Number(loteIdRaw)
      if (isNaN(loteId)) return

      if (!groups[loteId]) {
        const config = lotesConfig.find(c => String(c.lote).trim() === loteIdRaw)
        const codigo = config?.codigo || "---"
        const masterStatus = (config?.status || config?.Status || item.status || "Aguardando").toUpperCase()
        const base = baseCodigos.find(b => String(b["Código"]).trim() === String(codigo).trim())
        const descricao = base?.["Descrição"] || (config ? `Produto ${codigo}` : "Lote não configurado")
        const embalagensMaster = config?.embalagens || 0
        const gradeValue = base?.["Grade"] ? Number(base["Grade"]) : 0

        groups[loteId] = {
          lote: loteId,
          codigo: codigo,
          descricao: descricao,
          grade: gradeValue,
          totalEmbalagens: embalagensMaster,
          totalEnviado: 0,
          totalRetornado: 0,
          totalRejeitado: 0,
          totalAvarias: 0,
          items: [],
          status: masterStatus,
          progresso: 0
        }
      }
      
      const situacaoNormalizada = (item.situacao || '').toLowerCase();
      if (['entregues ao conserto', 'entregues ao cd', 'armazenado', 'retornado ao g300'].includes(situacaoNormalizada)) {
        groups[loteId].totalEnviado += item.quantidade_enviada || 0
      }
      groups[loteId].totalRetornado += item.quantidade_retornada || 0
      groups[loteId].totalRejeitado += item.quantidade_rejeitada || 0
      groups[loteId].totalAvarias += item.embalagens_avariadas || 0
      groups[loteId].items.push(item)
    })

    lotesConfig.forEach(config => {
      const loteId = Number(String(config.lote).trim())
      if (isNaN(loteId) || groups[loteId]) return

      const codigo = config.codigo || "---"
      const masterStatus = (config.status || config.Status || "Aguardando").toUpperCase()
      const base = baseCodigos.find(b => String(b["Código"]).trim() === String(codigo).trim())

      groups[loteId] = {
        lote: loteId,
        codigo,
        descricao: base?.["Descrição"] || `Produto ${codigo}`,
        grade: base?.["Grade"] ? Number(base["Grade"]) : 0,
        totalEmbalagens: config.embalagens || 0,
        totalEnviado: 0,
        totalRetornado: 0,
        totalRejeitado: 0,
        totalAvarias: 0,
        items: [],
        status: masterStatus,
        progresso: 0
      }
    })

    return Object.values(groups).map(lote => ({
      ...lote,
      progresso: Math.min(100, (lote.totalRetornado / (lote.totalEnviado || 1)) * 100)
    })).filter(lote => {
      const matchesSearch = lote.codigo?.toLowerCase().includes(search.toLowerCase()) ||
                           lote.descricao?.toLowerCase().includes(search.toLowerCase()) ||
                           lote.lote.toString().includes(search)
      const matchesStatus = activeStatus === 'all' || lote.status === activeStatus.toUpperCase()
      const matchesSituacao = activeSituacao === 'all' || lote.items.some(item => (item.situacao || 'Em preparação').toLowerCase() === activeSituacao.toLowerCase())
      return matchesSearch && matchesStatus && matchesSituacao
    }).sort((a, b) => {
      const dateA = Math.max(...a.items.map(i => i.data_inicio ? new Date(i.data_inicio).getTime() : 0));
      const dateB = Math.max(...b.items.map(i => i.data_inicio ? new Date(i.data_inicio).getTime() : 0));
      return dateB - dateA;
    }).map(lote => ({
      ...lote,
      items: [...lote.items].sort((a, b) => {
        const dA = a.data_inicio ? new Date(a.data_inicio).getTime() : 0;
        const dB = b.data_inicio ? new Date(b.data_inicio).getTime() : 0;
        return dA - dB;
      })
    }))
  }, [records, lotesConfig, baseCodigos, search, activeStatus, activeSituacao])

  const formatPallets = (total: number, grade: number, abbreviated = false) => {
    if (!grade || grade <= 0 || !total || total <= 0) return null
    const pallets = Math.floor(total / grade)
    const pieces = total % grade

    const palLabel = abbreviated ? 'pal' : (pallets === 1 ? 'palete' : 'paletes')
    const pçLabel = abbreviated ? 'pç' : (pieces === 1 ? 'peça' : 'peças')

    if (pallets > 0 && pieces > 0) return `${pallets} ${palLabel} + ${pieces} ${pçLabel}`
    if (pallets > 0) return `${pallets} ${palLabel}`
    return `${pieces} ${pçLabel}`
  }

  const getStatusConfig = (status: string) => {
    const s = status?.toUpperCase() || 'AGUARDANDO'
    switch (s) {
      case 'FINALIZADO': return { style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' }
      case 'EM ANDAMENTO': return { style: 'bg-blue-500/10 text-blue-400 border-blue-500/20', dot: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse' }
      case 'PAUSADO': return { style: 'bg-rose-500/10 text-rose-400 border-rose-500/20', dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' }
      case 'AGUARDANDO': return { style: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' }
      case 'EM FILA': return { style: 'bg-violet-500/15 text-violet-400 border-violet-500/30', dot: 'bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]' }
      default: return { style: 'bg-slate-500/10 text-slate-400 border-slate-500/20', dot: 'bg-slate-500' }
    }
  }



  const renderDocumentTable = (text: string, colorClass: string) => {
    if (!text || text === '---') return null;
    const items = text.split(/[\s\n,]+/).filter(Boolean);
    if (items.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1.5 w-full mt-2">
        {items.map((item, idx) => (
          <div 
            key={`${item}-${idx}`} 
            className={cn(
              "px-3 py-1 rounded-md bg-white/[0.03] border border-white/5 text-[10px] font-mono font-black transition-all hover:bg-white/10 select-all cursor-text",
              colorClass
            )}
          >
            {item}
          </div>
        ))}
      </div>
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    // Replace hyphens with slashes to avoid UTC shift
    const cleanDate = dateStr.includes('T') ? dateStr : dateStr.replace(/-/g, '/')
    const date = new Date(cleanDate)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const formatDayMonth = (isoDate: string | null | undefined) => {
    if (!isoDate) return '--/--';
    const parts = isoDate.split('T')[0].split('-');
    if (parts.length < 3) return '--/--';
    const [y, m, d] = parts;
    return `${d}/${m}`;
  };

  const totalRetrabalhado = records.reduce((s, i) => s + (i.quantidade_retornada || 0), 0)
  const totalRegistros = registrosData.reduce((acc, curr) => acc + (Number(curr.Entrada) || 0) - (Number(curr.Saída) || 0), 0)
  const percentualRetrabalhado = Math.round((totalRetrabalhado / ((totalRegistros + totalRetrabalhado) || 1)) * 100)

  return (
    <div className="space-y-4 pb-12">
      <GlobalStyles />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: "Qtd Retrabalhada", value: totalRetrabalhado, icon: TrendingUp, color: "text-emerald-400" },
          { label: "% Retrabalhado", value: `${percentualRetrabalhado}%`, icon: Sparkles, color: "text-blue-400" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="group relative p-4 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-xl">
            <div className="relative z-10 flex items-center gap-4">
              <div className={cn("p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10", stat.color)}><stat.icon size={16} /></div>
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{stat.label}</span>
                <span className="text-xl font-black text-slate-900 dark:text-white font-mono">{stat.value}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-3">
        <div className="flex-1 flex flex-wrap items-center gap-2 bg-slate-50/50 dark:bg-[#0F172A]/50 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-sm">
          {STATUS_OPTIONS.map((status) => (
            <button key={status.id} onClick={() => setActiveStatus(status.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200", activeStatus === status.id ? "bg-blue-600 text-white shadow-md scale-105" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5")}>
              <status.icon size={12} className={cn(activeStatus === status.id ? "text-white" : status.color)} />
              {status.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input type="text" placeholder="Filtrar por lote ou SKU..." className="w-full bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 pl-9 pr-3 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-400 shadow-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          
          {user && (
            <button 
              onClick={() => setIsNewLoteModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-600/20 transition-all font-black text-[10px] uppercase shrink-0"
            >
              <Plus size={14} />
              Novo Lote
            </button>
          )}
        </div>
      </div>

      <div className="pt-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-80 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-slate-200 dark:border-white/5 animate-pulse" />
              ))}
            </div>
          ) : groupedData.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {groupedData.map((lote) => (
                <motion.div 
                  layout 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95 }} 
                  key={lote.displayId || lote.lote} 
                  onClick={() => setSelectedLoteDetail(lote)}
                  className="group relative bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/5 rounded-[2.5rem] transition-all duration-500 overflow-hidden shadow-2xl hover:border-blue-500/30 hover:shadow-blue-500/10 cursor-pointer flex flex-col"
                >
                  {/* Card Header with Status */}
                  <div className="absolute top-6 left-6 z-30">
                    <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest backdrop-blur-md", getStatusConfig(lote.status).style)}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", getStatusConfig(lote.status).dot)} />
                      {lote.status}
                    </div>
                  </div>
                  {/* Edit Button */}
                  {user && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingLote(lote);
                      }}
                      className="absolute top-6 right-6 z-30 p-2 rounded-xl bg-white/5 hover:bg-blue-600 border border-white/10 text-white/50 hover:text-white transition-all duration-300 backdrop-blur-md opacity-0 group-hover:opacity-100"
                    >
                      <RefreshCw size={12} />
                    </button>
                  )}
                  {/* Image Section - Prominent */}
                 <div className="relative h-44 flex items-center justify-center p-8 bg-[#0F172A] overflow-hidden border-b border-white/5">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 via-transparent to-black/40" />
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12">
                      <Package size={140} />
                    </div>
                    
                    <motion.div 
                      whileHover={{ scale: 1.1, y: -10 }}
                      className="relative w-40 h-40 flex items-center justify-center transition-all duration-700"
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Package size={56} className="text-slate-800/30" />
                      </div>
                      {lote.codigo && lote.codigo !== "---" && (
                        <img 
                          src={`https://bvgwlkdqmkuuhqiwzfti.supabase.co/storage/v1/object/public/Store/Codigos%20icon/${lote.codigo?.trim() || '---'}.png`}
                          alt={lote.codigo}
                          className="w-full h-full object-contain relative z-20 drop-shadow-[0_32px_64px_rgba(0,0,0,0.8)]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </motion.div>
                  </div>

                  {/* Card Content */}
                  <div className="p-8 pt-6 flex flex-col flex-1">
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[12px] font-black text-blue-400 font-mono tracking-[0.2em] bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                          {lote.codigo}
                        </span>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          LOTE {lote.lote}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">
                        {lote.descricao}
                      </h3>
                    </div>

                    {/* Compact Metrics Grid */}
               <div className="grid grid-cols-3 gap-4 mb-6 mt-auto">
  <div className="space-y-1">
    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Embalagens</span>
    <div className="flex items-baseline gap-1">
      <span className="text-base font-black text-white font-mono">{lote.totalEmbalagens}</span>
      <span className="text-[9px] font-black text-slate-600 uppercase">emb</span>
    </div>
    {lote.grade > 0 && lote.totalEmbalagens > 0 && (
      <span className="text-[9px] font-black text-slate-600 uppercase block">
        {formatPallets(lote.totalEmbalagens, lote.grade, true)}
      </span>
    )}
  </div>
  <div className="space-y-1">
    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest block">Enviado</span>
    <div className="flex items-baseline gap-1">
      <span className="text-base font-black text-blue-400 font-mono">{lote.totalEnviado}</span>
    </div>
    <span className="text-[9px] font-black text-blue-500/40 uppercase block">
      {formatPallets(lote.totalEnviado, lote.grade, true)}
    </span>
  </div>
  <div className="space-y-1">
    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block">Retrab.</span>
    <div className="flex items-baseline gap-1">
      <span className="text-base font-black text-emerald-400 font-mono">{lote.totalRetornado}</span>
    </div>
    <span className="text-[9px] font-black text-emerald-500/40 uppercase block">
      {formatPallets(lote.totalRetornado, lote.grade, true)}
    </span>
  </div>
</div>

                    {/* Progress Bar */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Progresso Total</span>
                        <span className="text-[11px] font-black text-blue-400 font-mono">{Math.round(lote.progresso)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${lote.progresso}%` }} 
                          className={cn("h-full rounded-full transition-all duration-1000", lote.progresso === 100 ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]")} 
                        />
                      </div>
                    </div>

                    {/* Add Reserva Overlay for Quick Action */}
                    {user && (
                      <div className="mt-6 pt-5 border-t border-white/5 flex justify-end">
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-white/5 rounded-[3rem] border border-dashed border-slate-300 dark:border-white/10">
              <Package size={48} className="text-slate-300 dark:text-white/10 mb-4" />
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Nenhum lote encontrado</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Detail Modal for Lote Contents */}
      <AnimatePresence>
        {selectedLoteDetail && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-0">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => {
                setSelectedLoteDetail(null);
                setSelectedReservas(new Set());
                setSelectionMode(false);
                setModalSearch("");
              }} 
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }} className="relative w-full h-full bg-[#0A0F1D] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
              <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none" />
              
              {/* Section 1: Header & Identity - Top Priority */}
              <div className="px-12 py-1 flex items-center justify-between shrink-0 relative z-10 border-b border-white/5 bg-white/[0.01]">
                <div className="flex items-center gap-6" />

                <div className="flex items-center gap-4">
                  {user && (
                    <>
                      {selectionMode && selectedReservas.size > 0 && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={handlePrintQR}
                          className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/30 active:scale-95"
                        >
                          <Printer size={14} />
                          Imprimir ({selectedReservas.size})
                        </motion.button>
                      )}
                      
                      <button 
                        onClick={() => {
                          const itemsToGroup = selectionMode && selectedReservas.size > 0 
                            ? selectedLoteDetail.items.filter(item => selectedReservas.has(item.id))
                            : selectedLoteDetail.items.filter(item => !item.numero_da_viagem);
                          
                          // Reset rows for new voyage
                          setExcelRows(Array.from({ length: 20 }, () => ({ a501: '', g501: '', qtd: '' })));
                          setEditingViagemGroup({ number: "", items: itemsToGroup });
                          setIsViagemModalOpen(true);
                        }}
                        className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-600/30 active:scale-95"
                      >
                        <Truck size={14} />
                        Nova Viagem
                      </button>


                    </>
                  )}
                  <button 
                    onClick={() => {
                      setSelectedLoteDetail(null);
                      setSelectedReservas(new Set());
                      setSelectionMode(false);
                      setModalSearch("");
                    }}
                    className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 text-slate-400 hover:text-white hover:bg-rose-500/20 transition-all border border-white/10"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Section 2: Dashboard Overview - Milestone Volume Grid */}
              <div className="grid grid-cols-7 gap-3 px-12 py-1 shrink-0 border-b border-white/5 relative z-10 bg-white/[0.01]">
                {(() => {
                  const items = selectedLoteDetail.items;
                  const filterId = modalSituacaoFilter.toLowerCase();
                  
                  // Calculate volumes per milestone (each situação is independent)
                  const vTotal = selectedLoteDetail.totalEmbalagens;
                  const vEmPreparacao = items.reduce((acc, curr) => {
                    const sit = (curr.situacao || 'Em preparação').toLowerCase();
                    return acc + (sit === 'em preparação' ? (curr.quantidade_enviada || 0) : 0);
                  }, 0);
                  const vPendentes = items.reduce((acc, curr) => {
                    const sit = (curr.situacao || '').toLowerCase();
                    return acc + (sit === 'pendentes' ? (curr.quantidade_enviada || 0) : 0);
                  }, 0);
                  const vConserto = items.reduce((acc, curr) => {
                    const sit = (curr.situacao || '').toLowerCase();
                    return acc + (sit === 'entregues ao conserto' ? (curr.quantidade_enviada || 0) : 0);
                  }, 0);
                  const vCD = items.reduce((acc, curr) => {
                    const sit = (curr.situacao || '').toLowerCase();
                    return acc + (sit === 'entregues ao cd' ? (curr.quantidade_enviada || 0) : 0);
                  }, 0);
                  const vG300 = items.reduce((acc, curr) => {
                    const sit = (curr.situacao || '').toLowerCase();
                    return acc + (sit === 'retornado ao g300' ? (curr.quantidade_enviada || 0) : 0);
                  }, 0);
                  const vArmazenado = items.reduce((acc, curr) => {
                    const sit = (curr.situacao || '').toLowerCase();
                    return acc + (sit === 'armazenado' ? (curr.quantidade_enviada || 0) : 0);
                  }, 0);

                  const milestones = [
                    { id: 'all', label: 'Total de Embalagens', value: vTotal, unit: 'emb', icon: Database, color: 'text-white', active: filterId === 'all' },
                    { id: 'em preparação', label: 'Em Preparação', value: vEmPreparacao, unit: 'pçs', icon: Hourglass, color: 'text-slate-400', active: filterId === 'em preparação' },
                    { id: 'pendentes', label: 'Pendentes', value: vPendentes, unit: 'pçs', icon: Clock, color: 'text-amber-400', active: filterId === 'pendentes' },
                    { id: 'entregues ao conserto', label: 'No Conserto', value: vConserto, unit: 'pçs', icon: ArrowRight, color: 'text-purple-400', active: filterId === 'entregues ao conserto' },
                    { id: 'entregues ao cd', label: 'Retornado ao CD', value: vCD, unit: 'pçs', icon: Truck, color: 'text-blue-400', active: filterId === 'entregues ao cd' },
                    { id: 'retornado ao g300', label: 'Retornado ao G300', value: vG300, unit: 'pçs', icon: RefreshCw, color: 'text-indigo-400', active: filterId === 'retornado ao g300' },
                    { id: 'armazenado', label: 'Armazenado', value: vArmazenado, unit: 'pçs', icon: CheckCircle2, color: 'text-emerald-400', active: filterId === 'armazenado' },
                  ];

                  return milestones.map((stat, i) => (
                    <button 
                      key={stat.label} 
                      onClick={() => setModalSituacaoFilter(stat.id)}
                      className={cn(
                        "bg-white/[0.02] border p-3 rounded-xl flex items-center justify-between hover:bg-white/[0.04] transition-all group/card relative overflow-hidden text-left",
                        stat.active ? "border-blue-500/30 bg-blue-500/[0.02]" : "border-white/5"
                      )}
                    >
                      {stat.active && <div className="absolute top-0 left-0 w-full h-[1px] bg-blue-500/50" />}
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{stat.label}</p>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-black ${stat.color} font-mono tracking-tighter`}>{stat.value}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase font-mono">{stat.unit}</span>
                        </div>
                        {stat.unit !== 'emb' && formatPallets(stat.value, selectedLoteDetail.grade) && (
                          <span className={`text-[12px] font-light uppercase tracking-widest ${stat.color} opacity-90`}>
                            {formatPallets(stat.value, selectedLoteDetail.grade)}
                          </span>
                        )}
                      </div>
                      <div className={cn(
                        "p-2 rounded-lg bg-white/[0.03] transition-all",
                        stat.color,
                        stat.active ? "opacity-100" : "opacity-40 group-hover/card:opacity-100"
                      )}>
                        <stat.icon size={14} />
                      </div>
                    </button>
                  ));
                })()}
              </div>

              {/* Modal Internal Filter - Situation & Search */}
              <div className="px-12 py-2 bg-white/[0.01] border-b border-white/5 flex items-center justify-between gap-6 relative z-20">
                <div className="relative flex-1 max-w-md group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Pesquisar por reserva ou estorno..." 
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 pl-12 pr-4 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white/[0.05] transition-all placeholder:text-slate-500"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                  />
                  {modalSearch && (
                    <button 
                      onClick={() => setModalSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10 text-slate-500 hover:text-white transition-all"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      if (selectionMode) setSelectedReservas(new Set());
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                      selectionMode 
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/30" 
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <CheckSquare size={12} />
                    {selectionMode ? "Desabilitar Seleção" : "Habilitar Seleção"}
                  </button>

                  {selectionMode && (
                    <button
                      onClick={() => {
                        const preparedIds = selectedLoteDetail.items
                          .filter(item => (item.situacao || 'Em preparação').toLowerCase() === 'em preparação')
                          .map(i => i.id);
                        setSelectedReservas(new Set(preparedIds));
                      }}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all"
                    >
                      <QrCode size={12} />
                      Selecionar Preparados
                    </button>
                  )}

                  {selectionMode && selectedReservas.size > 0 && (
                    <button
                      onClick={() => {
                        const selectedItems = selectedLoteDetail.items.filter(item => selectedReservas.has(item.id));
                        setEditingViagemGroup({ number: "", items: selectedItems });
                        setIsViagemModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-blue-600 text-[9px] font-black text-white uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                    >
                      <Truck size={12} />
                      Vincular à Viagem
                    </button>
                  )}

                </div>
              </div>

              {/* Section 3: Execution Logs */}
              <div className="flex-1 overflow-y-auto p-6 no-scrollbar bg-black/20">
                <div className="bg-white/[0.02] border border-white/5 overflow-x-auto shadow-2xl rounded-xl">
                                {(() => {
                                  const filteredForTable = selectedLoteDetail.items
                                    .filter(item => {
                                      const matchesSituacao = modalSituacaoFilter === 'all' || (item.situacao || 'Em preparação').toLowerCase() === modalSituacaoFilter.toLowerCase();
                                      const searchLower = modalSearch.toLowerCase();
                                      const matchesSearch = !modalSearch || 
                                        (item.reserva_a501 || '').toLowerCase().includes(searchLower) ||
                                        (item.reserva_g501 || '').toLowerCase().includes(searchLower) ||
                                        (item.estorno_a501 || '').toLowerCase().includes(searchLower) ||
                                        (item.estorno_g501 || '').toLowerCase().includes(searchLower);
                                      return matchesSituacao && matchesSearch;
                                    });

                                  if (filteredForTable.length === 0) {
                                    return (
                                      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                                        <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                                          <Filter size={20} className="text-slate-600" />
                                        </div>
                                        <div>
                                          <p className="text-[13px] font-black text-slate-400 uppercase tracking-widest">Nenhuma reserva encontrada</p>
                                          <p className="text-[11px] text-slate-600 mt-1">Não há registros com a situação selecionada.</p>
                                        </div>
                                        <button
                                          onClick={() => setModalSituacaoFilter('all')}
                                          className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors"
                                        >
                                          Limpar filtro
                                        </button>
                                      </div>
                                    );
                                  }

                                  // Group by Viagem
                                  const groups: Record<string, typeof filteredForTable> = {};
                                  filteredForTable.forEach(item => {
                                    const key = item.numero_da_viagem || 'SEM_VIAGEM';
                                    if (!groups[key]) groups[key] = [];
                                    groups[key].push(item);
                                  });

                                  const sortedViagens = Object.keys(groups).sort((a, b) => {
                                    if (a === 'SEM_VIAGEM') return 1;
                                    if (b === 'SEM_VIAGEM') return -1;
                                    return Number(b) - Number(a);
                                  });

                                  return sortedViagens.map(viagemKey => {
                                    const items = groups[viagemKey];
                                    const isExpanded = expandedViagens === viagemKey;

                                    const firstItem = items[0];
                                    
                                    return (
                                      <div key={viagemKey} className="border-b border-white/5 last:border-0">
                                        {/* Group Header */}
                                        <div 
                                          onClick={() => toggleViagem(viagemKey)}
                                          className={cn(
                                            "flex items-center justify-between px-6 py-4 cursor-pointer transition-all",
                                            isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                                          )}
                                        >
                                          <div className="flex items-center gap-8">
                                            <div className="flex flex-col">
                                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Viagem</span>
                                              <span className="text-lg font-mono font-bold text-white tracking-wider">
                                                {viagemKey === 'SEM_VIAGEM' ? 'NÃO ATRIBUÍDA' : `#${viagemKey}`}
                                              </span>
                                            </div>
                                            
                                            <div className="flex flex-col">
                                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Data de Envio</span>
                                              <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-blue-400 opacity-70" />
                                                <span className="text-sm font-medium text-slate-300">
                                                  {viagemKey === 'SEM_VIAGEM' ? '--/--' : formatDayMonth(firstItem.enviado_ao_cd)}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="flex flex-col">
                                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Turno</span>
                                              <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-amber-400 opacity-70" />
                                                <span className="text-sm font-bold text-white tracking-wider uppercase">
                                                  {firstItem.turno_da_viagem ? `TURNO ${firstItem.turno_da_viagem}` : '--'}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="flex flex-col">
                                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Volume Total</span>
                                              <div className="flex items-baseline gap-1">
                                                <span className="text-sm font-bold text-emerald-400">
                                                  {items.reduce((acc, curr) => acc + (curr.quantidade_enviada || 0), 0)}
                                                </span>
                                                <span className="text-[10px] text-emerald-500/50 font-bold uppercase tracking-widest">UN</span>
                                              </div>
                                            </div>

                                            <div className="flex flex-col">
                                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Situação</span>
                                              <div className={cn(
                                                "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border",
                                                items.every(i => (i.situacao || '').toLowerCase() === 'armazenado')
                                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                                  : "bg-blue-600/10 border-blue-500/20 text-blue-400"
                                              )}>
                                                {items.every(i => (i.situacao || '').toLowerCase() === 'armazenado') ? 'CONCLUÍDO' : 'EM ANDAMENTO'}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-3">
                                            {user && viagemKey !== 'SEM_VIAGEM' && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingViagemGroup({ 
                                                    number: viagemKey, 
                                                    items: items 
                                                  });
                                                  setIsViagemModalOpen(true);
                                                }}
                                                className="p-2 rounded-xl bg-white/5 hover:bg-blue-600 border border-white/10 text-slate-400 hover:text-white transition-all group/edit"
                                              >
                                                <Edit3 size={14} className="group-hover/edit:scale-110 transition-transform" />
                                              </button>
                                            )}
                                            <div className={cn(
                                              "w-8 h-8 rounded-full flex items-center justify-center border border-white/10 transition-transform duration-300",
                                              isExpanded ? "rotate-180 bg-blue-600/10 border-blue-500/30 text-blue-400" : "text-slate-500"
                                            )}>
                                              <ChevronDown size={18} />
                                            </div>
                                          </div>

                                        </div>

                                        {/* Group Content */}
                                        <AnimatePresence>
                                          {isExpanded && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: 'auto', opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                                              className="overflow-hidden"
                                            >
                                              <div className="bg-black/20 pb-4 overflow-x-auto custom-scrollbar relative">
                                                <div className="min-w-[1650px]">
                                                {/* Table Header inside Group */}
                                                <div className={cn(
                                                  "grid gap-3 px-6 py-2 border-b border-white/5 items-center bg-white/[0.01] sticky top-0 z-30",
                                                  selectionMode 
                                                    ? "grid-cols-[3.5rem_3.5rem_110px_110px_150px_100px_110px_100px_110px_110px_150px_110px_110px_1fr]" 
                                                    : "grid-cols-[3.5rem_110px_110px_150px_100px_110px_100px_110px_110px_150px_110px_110px_1fr]" 
                                                )}>
                                                  {selectionMode && (
                                                    <div className="flex justify-center">
                                                      <button 
                                                        onClick={() => {
                                                          const groupIds = items.map(i => i.id);
                                                          const allSelectedInGroup = groupIds.every(id => selectedReservas.has(id));
                                                          
                                                          const newSelection = new Set(selectedReservas);
                                                          if (allSelectedInGroup) {
                                                            groupIds.forEach(id => newSelection.delete(id));
                                                          } else {
                                                            groupIds.forEach(id => newSelection.add(id));
                                                          }
                                                          setSelectedReservas(newSelection);
                                                        }}
                                                        className={cn(
                                                          "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300",
                                                          items.every(id => selectedReservas.has(id.id))
                                                            ? "bg-emerald-500 border-emerald-400" 
                                                            : "border-white/10 bg-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                                                        )}
                                                      >
                                                        {items.some(id => selectedReservas.has(id.id)) && (
                                                          <Check size={14} className={cn("text-white stroke-[4]", !items.every(id => selectedReservas.has(id.id)) && "opacity-50")} />
                                                        )}
                                                      </button>
                                                    </div>
                                                  )}
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left pl-2 whitespace-nowrap">#</span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left whitespace-nowrap">Reserva (A)</span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left whitespace-nowrap">Reserva (G)</span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left whitespace-nowrap">Volume</span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left flex items-center gap-1 whitespace-nowrap">
                                                    <Calendar size={10} className="opacity-50" /> Criado em
                                                  </span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left flex items-center gap-1 whitespace-nowrap">
                                                    <Calendar size={10} className="opacity-50" /> Envio ao Conserto
                                                  </span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-center whitespace-nowrap">R. Confirmada</span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left whitespace-nowrap">Estorno (A)</span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left whitespace-nowrap">Estorno (G)</span>
                                                  <span className="text-[9px] font-bold text-emerald-500/50 uppercase tracking-[0.1em] text-left whitespace-nowrap">Retornado</span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left flex items-center gap-1 whitespace-nowrap">
                                                    <Calendar size={10} className="opacity-50" /> Envio ao G300
                                                  </span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left flex items-center gap-1 whitespace-nowrap">
                                                    <Calendar size={10} className="opacity-50" /> Armazenamento
                                                  </span>
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.1em] text-left whitespace-nowrap">Situação</span>
                                                </div>
                                                {items.map((item, idx) => (
                                                  <motion.div 
                                                    initial={{ opacity: 0, x: -10 }} 
                                                    animate={{ opacity: 1, x: 0 }} 
                                                    transition={{ delay: idx * 0.03 }}
                                                    key={item.id} 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (user) {
                                                        setEditingReserva(item);
                                                        // Pre-populate docRows from existing estorno data
                                                        const a501List = (item.estorno_a501 || '').split(/[\s\n,]+/).filter(Boolean);
                                                        const g501List = (item.estorno_g501 || '').split(/[\s\n,]+/).filter(Boolean);
                                                        const maxLen = Math.max(a501List.length, g501List.length, 15);
                                                        setDocRows(Array.from({ length: maxLen }, (_, i) => ({
                                                          a501: a501List[i] || '',
                                                          g501: g501List[i] || '',
                                                        })));
                                                      }
                                                    }}
                                                    className={cn(
                                                      "group/row grid gap-3 px-6 py-2.5 hover:bg-white/[0.04] border-b border-white/5 transition-colors items-center cursor-pointer last:border-0 relative hover:z-[50]",
                                                      selectionMode 
                                                        ? "grid-cols-[3.5rem_3.5rem_110px_110px_150px_100px_110px_100px_110px_110px_150px_110px_110px_1fr]" 
                                                        : "grid-cols-[3.5rem_110px_110px_150px_100px_110px_100px_110px_110px_150px_110px_110px_1fr]",
                                                      selectedReservas.has(item.id) && "bg-emerald-600/5"
                                                    )}
                                                  >
                                                    {selectionMode && (
                                                      <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                                                        <button 
                                                          onClick={() => {
                                                            const newSelection = new Set(selectedReservas);
                                                            if (newSelection.has(item.id)) newSelection.delete(item.id);
                                                            else newSelection.add(item.id);
                                                            setSelectedReservas(newSelection);
                                                          }}
                                                          className={cn(
                                                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300",
                                                            selectedReservas.has(item.id) 
                                                              ? "bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-110" 
                                                              : "border-white/10 bg-white/5 group-hover/row:border-emerald-500/50 hover:bg-emerald-500/5"
                                                          )}
                                                        >
                                                          {selectedReservas.has(item.id) && <Check size={14} className="text-white stroke-[4]" />}
                                                        </button>
                                                      </div>
                                                    )}
                                                    <div className="flex items-center whitespace-nowrap">
                                                      <span className="text-[12px] font-medium text-slate-500 group-hover/row:text-blue-400 transition-colors pl-2 tracking-wider whitespace-nowrap">
                                                        {String(idx + 1).padStart(2, '0')}
                                                      </span>
                                                    </div>
                                                    
                                                    <div className="flex flex-row flex-nowrap items-center gap-2 pr-2 whitespace-nowrap">
                                                      <CompactList text={item.reserva_a501} colorClass="text-white" />
                                                    </div>
                                                    <div className="flex flex-row flex-nowrap items-center gap-2 pr-2 whitespace-nowrap">
                                                      <CompactList text={item.reserva_g501} colorClass="text-slate-300" />
                                                    </div>

                                                    <div className="flex flex-col items-start justify-center whitespace-nowrap">
                                                      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                                                        <span className="text-[16px] font-light text-white font-mono tracking-wider whitespace-nowrap">{item.quantidade_enviada}</span>
                                                        <span className="text-[9px] font-light text-blue-400/70 uppercase tracking-widest whitespace-nowrap">{formatPallets(item.quantidade_enviada, selectedLoteDetail.grade, false)}</span>
                                                      </div>
                                                    </div>

                                                    <div className="flex items-center whitespace-nowrap">
                                                      <span className={cn("text-[11px] font-light font-mono tracking-wider transition-colors whitespace-nowrap", item.enviado_ao_cd ? "text-blue-400" : "text-white/5")}>
                                                        {formatDayMonth(item.enviado_ao_cd)}
                                                      </span>
                                                    </div>

                                                    <div 
                                                       className="flex items-center whitespace-nowrap cursor-pointer group/date"
                                                       onClick={async (e) => {
                                                         e.stopPropagation();
                                                         if (!user) return;
                                                         const now = new Date();
                                                         const isoDate = now.toISOString().split('T')[0];
                                                         const newVal = item.enviado_ao_conserto ? null : isoDate;
                                                         const { error } = await supabase.from('retrabalhos').update({ enviado_ao_conserto: newVal }).eq('id', item.id);
                                                         if (!error) {
                                                           setRecords(prev => prev.map(r => r.id === item.id ? { ...r, enviado_ao_conserto: newVal } : r));
                                                         }
                                                       }}
                                                     >
                                                       <span className={cn(
                                                         "text-[11px] font-light font-mono tracking-wider transition-all whitespace-nowrap px-2 py-0.5 rounded-md", 
                                                         item.enviado_ao_conserto ? "text-purple-400 bg-purple-500/10" : "text-white/5 hover:bg-white/5 hover:text-white/40"
                                                       )}>
                                                         {formatDayMonth(item.enviado_ao_conserto)}
                                                       </span>
                                                     </div>

                                                     <div className="flex items-center justify-center whitespace-nowrap cursor-pointer">
                                                       <button
                                                         onClick={async (e) => {
                                                           e.stopPropagation();
                                                           if (!user) return;
                                                           const newVal = !item.Sistema;
                                                           console.log('Updating Sistema to:', newVal, 'for item:', item.id);
                                                           const { error } = await supabase.from('retrabalhos').update({ Sistema: newVal }).eq('id', item.id);
                                                           if (!error) {
                                                             setRecords(prev => prev.map(r => r.id === item.id ? { ...r, Sistema: newVal } : r));
                                                           } else {
                                                             console.error('Erro detalhado ao atualizar sistema:', error.message || error);
                                                             alert("Erro ao atualizar 'R. Confirmada': " + (error.message || "Coluna não encontrada ou erro de permissão."));
                                                           }
                                                         }}
                                                         className={cn(
                                                           "w-10 h-5 rounded-full relative transition-all duration-300 flex items-center px-1 group/toggle",
                                                           item.Sistema ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-white/5 border border-white/10 hover:bg-white/10"
                                                         )}
                                                       >
                                                         <motion.div
                                                           animate={{ x: item.Sistema ? 20 : 0 }}
                                                           className={cn(
                                                             "w-3 h-3 rounded-full shadow-lg transition-colors",
                                                             item.Sistema ? "bg-emerald-400 shadow-emerald-500/50" : "bg-slate-500 group-hover/toggle:bg-slate-400"
                                                           )}
                                                         />
                                                       </button>
                                                     </div>
                                                    
                                                    <div className="flex flex-row flex-nowrap items-center gap-2 pr-2 whitespace-nowrap">
                                                      <CompactList text={item.estorno_a501} colorClass="text-blue-400" />
                                                    </div>
                                                    <div className="flex flex-row flex-nowrap items-center gap-2 pr-2 whitespace-nowrap">
                                                      <CompactList text={item.estorno_g501} colorClass="text-blue-400" />
                                                    </div>

                                                    <div className="flex flex-col items-start justify-center whitespace-nowrap">
                                                      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                                                        <span className="text-[16px] font-light text-emerald-400 font-mono tracking-wider whitespace-nowrap">{item.quantidade_retornada || 0}</span>
                                                        <span className="text-[9px] font-light text-emerald-400/70 uppercase tracking-widest whitespace-nowrap">{formatPallets(item.quantidade_retornada, selectedLoteDetail.grade, false)}</span>
                                                      </div>
                                                    </div>

                                                    <div 
                                                      className="flex items-center whitespace-nowrap cursor-pointer group/date"
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!user) return;
                                                        const now = new Date();
                                                        const isoDate = now.toISOString().split('T')[0];
                                                        const newVal = item.enviado_ao_g300 ? null : isoDate;
                                                        const { error } = await supabase.from('retrabalhos').update({ enviado_ao_g300: newVal }).eq('id', item.id);
                                                        if (!error) {
                                                          setRecords(prev => prev.map(r => r.id === item.id ? { ...r, enviado_ao_g300: newVal } : r));
                                                        }
                                                      }}
                                                    >
                                                      <span className={cn(
                                                        "text-[11px] font-light font-mono tracking-wider transition-all whitespace-nowrap px-2 py-0.5 rounded-md", 
                                                        item.enviado_ao_g300 ? "text-indigo-400 bg-indigo-500/10" : "text-white/5 hover:bg-white/5 hover:text-white/40"
                                                      )}>
                                                        {formatDayMonth(item.enviado_ao_g300)}
                                                      </span>
                                                    </div>

                                                    <div 
                                                      className="flex items-center whitespace-nowrap cursor-pointer group/date"
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!user) return;
                                                        const now = new Date();
                                                        const isoDate = now.toISOString().split('T')[0];
                                                        const newVal = item.armazenado ? null : isoDate;
                                                        const { error } = await supabase.from('retrabalhos').update({ armazenado: newVal }).eq('id', item.id);
                                                        if (!error) {
                                                          setRecords(prev => prev.map(r => r.id === item.id ? { ...r, armazenado: newVal } : r));
                                                        }
                                                      }}
                                                    >
                                                      <span className={cn(
                                                        "text-[11px] font-light font-mono tracking-wider transition-all whitespace-nowrap px-2 py-0.5 rounded-md", 
                                                        item.armazenado ? "text-emerald-400 bg-emerald-500/10" : "text-white/5 hover:bg-white/5 hover:text-white/40"
                                                      )}>
                                                        {formatDayMonth(item.armazenado)}
                                                      </span>
                                                    </div>

                                                    <div 
                                                      className="flex items-start justify-center flex-col whitespace-nowrap cursor-pointer group/situacao"
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!user) return;
                                                        const current = item.situacao || 'Em preparação';
                                                        const options = SITUACAO_OPTIONS.map(o => o.value);
                                                        const currentIndex = options.indexOf(current);
                                                        const nextIndex = (currentIndex + 1) % options.length;
                                                        const newVal = options[nextIndex];
                                                        
                                                        const { error } = await supabase.from('retrabalhos').update({ situacao: newVal }).eq('id', item.id);
                                                        if (!error) {
                                                          setRecords(prev => prev.map(r => r.id === item.id ? { ...r, situacao: newVal } : r));
                                                        }
                                                      }}
                                                    >
                                                      <span className={cn(
                                                        "text-[10px] font-bold uppercase tracking-[0.1em] text-left w-full whitespace-nowrap leading-tight transition-all px-2 py-1 rounded-md hover:bg-white/5",
                                                        (item.situacao || 'Em preparação').toLowerCase() === 'armazenado' ? "text-emerald-400" :
                                                        (item.situacao || 'Em preparação').toLowerCase() === 'retornado ao g300' ? "text-indigo-400" :
                                                        (item.situacao || 'Em preparação').toLowerCase() === 'entregues ao cd' ? "text-blue-400" :
                                                        (item.situacao || 'Em preparação').toLowerCase() === 'entregues ao conserto' ? "text-purple-400" :
                                                        (item.situacao || 'Em preparação').toLowerCase() === 'pendentes' ? "text-amber-400" :
                                                        "text-slate-400"
                                                      )}>
                                                        {item.situacao || 'Em preparação'}
                                                      </span>
                                                    </div>
                                                  </motion.div>
                                                ))}
                                                </div>
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  });
                                })()}
                  </div>
                </div>
              
              </motion.div>
            </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isNewLoteModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsNewLoteModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <Plus className="text-blue-600 dark:text-blue-500" /> Novo Lote de Retrabalho
              </h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  lote: Number(formData.get('lote')),
                  codigo: String(formData.get('codigo')),
                  status: String(formData.get('status')),
                  embalagens: Number(formData.get('embalagens')),
                };
                
                const { error } = await supabase.from('lotes_config').insert([data]);
                if (!error) {
                  setIsNewLoteModalOpen(false);
                  fetchData();
                } else {
                  alert("Erro ao criar lote: " + error.message);
                }
              }} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Número do Lote</label>
                  <input 
                    name="lote" 
                    required 
                    type="number" 
                    defaultValue={Math.max(...lotesConfig.map(l => Number(l.lote) || 0), 0) + 1}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" 
                    placeholder="Ex: 4" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Código do Produto (SKU)</label>
                  <input name="codigo" required type="text" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" placeholder="Ex: 0685-04" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Embalagens</label>
                    <input name="embalagens" required type="number" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" placeholder="Qtd" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Status Inicial</label>
                    <select name="status" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500/50 transition-all appearance-none">
                      <option value="Em fila">Em fila</option>
                      <option value="Aguardando">Aguardando</option>
                      <option value="Em andamento">Em andamento</option>
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsNewLoteModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white text-[11px] font-black uppercase transition-all">Cancelar</button>
                  <button type="submit" className="flex-2 px-8 py-3 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase shadow-lg shadow-blue-500/20 transition-all">Criar Lote</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isNewReservaModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsNewReservaModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-teal-600" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                <Plus className="text-emerald-500" /> Nova Reserva
              </h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-6">Lote: {selectedLoteForReserva}</p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  lote: selectedLoteForReserva,
                  quantidade_enviada: Number(formData.get('quantidade_enviada')),
                  reserva_a501: String(formData.get('reserva_a501')),
                  reserva_g501: String(formData.get('reserva_g501')),
                  data_inicio: new Date().toISOString(),
                  status: 'EM ANDAMENTO'
                };
                
                const { error } = await supabase.from('retrabalhos').insert([data]);
                if (!error) {
                  setIsNewReservaModalOpen(false);
                  fetchData();
                } else {
                  alert("Erro ao adicionar reserva: " + error.message);
                }
              }} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Quantidade Enviada</label>
                  <input name="quantidade_enviada" required type="number" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500/50 transition-all" placeholder="Ex: 500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Reserva A501</label>
                    <input name="reserva_a501" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500/50 transition-all" placeholder="OP" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Reserva G501</label>
                    <input name="reserva_g501" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500/50 transition-all" placeholder="OP" />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsNewReservaModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white text-[11px] font-black uppercase transition-all">Cancelar</button>
                  <button type="submit" className="flex-2 px-8 py-3 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase shadow-lg shadow-emerald-500/20 transition-all">Adicionar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingReserva && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setEditingReserva(null)} 
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.98, y: 10 }} 
              className="relative w-full max-w-[1500px] max-h-[85vh] bg-[#0A0F1A] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_120px_-20px_rgba(0,0,0,0.9)] flex flex-col"
            >
              {/* Header - Ultra Premium */}
              <div className="relative px-10 py-8 border-b border-white/5 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                  <Database size={120} className="text-blue-500/20 rotate-12" />
                </div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-2xl shadow-blue-600/20">
                      <Edit3 size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        {selectedReservas.size > 1 && selectedReservas.has(editingReserva.id) 
                          ? `Editar Lote (${selectedReservas.size} itens)` 
                          : "Atualizar Reserva"
                        }
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[9px] font-black text-emerald-500 tracking-widest uppercase">Sistema Ativo</span>
                        </div>
                      </h2>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEditingReserva(null)} 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 text-slate-400 hover:text-white hover:bg-rose-500/20 transition-all border border-white/10 group"
                  >
                    <X size={24} className="group-hover:rotate-90 transition-transform" />
                  </button>
                </div>
              </div>
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
              <form id="edit-reserva-form" onSubmit={async (e) => {
                e.preventDefault();
                const isBulkEdit = selectedReservas.size > 1 && selectedReservas.has(editingReserva.id);
                const idsToUpdate = isBulkEdit ? Array.from(selectedReservas) : [editingReserva.id];
                
                const formData = new FormData(e.currentTarget);
               const data = {
  quantidade_retornada: Number(formData.get('quantidade_retornada')),
  quantidade_rejeitada: Number(formData.get('quantidade_rejeitada')),
  embalagens_avariadas: Number(formData.get('embalagens_avariadas')),
  reserva_a501: String(formData.get('reserva_a501') ?? ''),
  reserva_g501: String(formData.get('reserva_g501') ?? ''),
  numero_da_viagem: formData.get('numero_da_viagem')   // <-- corrigido
    ? Number(formData.get('numero_da_viagem')) 
    : null,
  enviado_ao_cd: (formData.get('enviado_ao_cd') as string) || null,
                  enviado_ao_conserto: (formData.get('enviado_ao_conserto') as string) || null,
                  enviado_ao_g300: (formData.get('enviado_ao_g300') as string) || null,
                  armazenado: (formData.get('armazenado') as string) || null,
                  estorno_a501: String(formData.get('estorno_a501') ?? ''),
                  estorno_g501: String(formData.get('estorno_g501') ?? ''),
                  status: tempStatus.toLowerCase(),
                  situacao: tempSituacao,
                  data_fim: (formData.get('data_fim') as string) || null
                };
                
                const updateData: any = { ...data };
                if (isBulkEdit) {
                  // Remover campos específicos de cada item em edição em lote
                  delete updateData.reserva_a501;
                  delete updateData.reserva_g501;
                  delete updateData.estorno_a501;
                  delete updateData.estorno_g501;
                }

                const { error } = await supabase.from('retrabalhos').update(updateData).in('id', idsToUpdate);
                if (!error) {
                  setRecords(prev => prev.map(r =>
                    idsToUpdate.includes(r.id) ? { ...r, ...updateData } : r
                  ));
                  setEditingReserva(null);
                } else {
                  console.error("Erro Supabase:", error);
                  const isMissingColumn = error.message.includes('column') || error.code === '42703';
                  alert(
                    isMissingColumn 
                      ? `ERRO DE BANCO: Uma ou mais colunas não foram encontradas. Por favor, execute o comando SQL completo no painel do Supabase.\n\nDetalhes: ${error.message}` 
                      : "Erro ao atualizar: " + error.message
                  );
                }
              }}>
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.1fr_1.6fr] gap-12">
                  {/* Coluna 1: Operacional & Estado */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 whitespace-nowrap">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2.5">
                        <BarChart3 size={14} className="text-blue-500" />
                        Métricas Operacionais
                      </h4>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { name: 'quantidade_retornada', label: 'Volume Retornado', icon: CheckCircle2, color: 'emerald', value: editingReserva.quantidade_retornada, unit: 'unidades', desc: 'Qtd. aprovada' },
                        { name: 'quantidade_rejeitada', label: 'Volume Rejeitado', icon: AlertCircle, color: 'rose', value: editingReserva.quantidade_rejeitada, unit: 'peças', desc: 'Qtd. avariada' },
                        { name: 'embalagens_avariadas', label: 'Embalagens Avariadas', icon: Package, color: 'amber', value: editingReserva.embalagens_avariadas, unit: 'un', desc: 'Danos físicos' }
                      ].map((field) => (
                        <div key={field.name} className="relative group p-4 rounded-[1.5rem] bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-500">
                          <div className="flex items-center justify-between mb-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg bg-${field.color}-500/10 text-${field.color}-400`}>
                                <field.icon size={14} />
                              </div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{field.label}</span>
                            </div>
                          </div>
                          <div className="flex items-baseline gap-2 whitespace-nowrap">
                            <input 
                              name={field.name}
                              type="number"
                              autoComplete="off"
                              defaultValue={field.value}
                              readOnly={!user}
                              className={cn(
                                "w-full bg-transparent border-none text-2xl font-black text-white font-mono focus:outline-none p-0 no-spinner tracking-tighter",
                                !user && "cursor-default text-slate-500"
                              )}
                            />
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{field.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4 pt-4">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 ml-1 whitespace-nowrap">
                        <Activity size={10} className="text-blue-500" />
                        Estado do Processo
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsSituacaoOpen(!isSituacaoOpen)}
                          className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-4 text-xs font-black text-white flex items-center justify-between group hover:border-blue-500/50 hover:bg-blue-500/5 transition-all whitespace-nowrap"
                        >
                          <span className="flex items-center gap-3">
                            <div className={cn(
                              "w-2 h-2 rounded-full animate-pulse",
                              SITUACAO_OPTIONS.find(o => o.value === tempSituacao)?.color || "bg-slate-500"
                            )} />
                            {tempSituacao}
                          </span>
                          <ChevronUp size={16} className={cn("text-slate-500 group-hover:text-blue-400 transition-transform", isSituacaoOpen && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                          {isSituacaoOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: -8, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute bottom-full left-0 w-full mb-2 bg-[#0F172A] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl z-[210] backdrop-blur-xl"
                            >
                              <div className="p-2 space-y-1">
                                {SITUACAO_OPTIONS.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      setTempSituacao(option.value);
                                      setIsSituacaoOpen(false);
                                    }}
                                    className={cn(
                                      "w-full px-5 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all whitespace-nowrap",
                                      tempSituacao === option.value 
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                                    )}
                                  >
                                    <div className={cn("w-2 h-2 rounded-full", option.color)} />
                                    {option.value}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Coluna 2: Logística & Cronograma */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 whitespace-nowrap">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2.5">
                        <Truck size={14} className="text-amber-500" />
                        Logística & Prazos
                      </h4>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1 whitespace-nowrap">
                          <Hash size={10} className="text-slate-400" />
                          Nº da Viagem
                        </label>
                        <input 
                          name="numero_da_viagem" 
                          type="text" 
                          autoComplete="off"
                          defaultValue={editingReserva.numero_da_viagem || ''}
                          className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:border-blue-500 focus:bg-blue-500/5 transition-all font-mono whitespace-nowrap"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1 whitespace-nowrap">
                          <Calendar size={10} className="text-blue-400" />
                          Criado em
                        </label>
                        <input 
                          name="enviado_ao_cd" 
                          type="date" 
                          defaultValue={editingReserva.enviado_ao_cd || ''}
                          className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:border-blue-500 focus:bg-blue-500/5 transition-all [color-scheme:dark] whitespace-nowrap"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { name: 'enviado_ao_conserto', label: 'Envio ao Conserto', icon: Hammer, color: 'text-purple-500' },
                          { name: 'enviado_ao_g300', label: 'Envio ao G300', icon: Warehouse, color: 'text-indigo-500' }
                        ].map(field => (
                          <div key={field.name} className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1 whitespace-nowrap">
                              <field.icon size={10} className={field.color} />
                              {field.label}
                            </label>
                            <input 
                              name={field.name}
                              type="date"
                              defaultValue={editingReserva[field.name as keyof RetrabalhoRecord] || ''}
                              className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3.5 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all [color-scheme:dark] whitespace-nowrap"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1 whitespace-nowrap">
                          <PackageCheck size={10} className="text-emerald-500" />
                          Armazenamento
                        </label>
                        <input 
                          name="armazenado" 
                          type="date" 
                          defaultValue={editingReserva.armazenado || ''}
                          className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 focus:bg-emerald-500/5 transition-all [color-scheme:dark] whitespace-nowrap"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1 whitespace-nowrap">
                          <CheckCircle2 size={10} className="text-emerald-400" />
                          Data de Finalização
                        </label>
                        <input 
                          name="data_fim" 
                          type="date" 
                          defaultValue={editingReserva.data_fim || ''}
                          className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 focus:bg-emerald-500/5 transition-all [color-scheme:dark] whitespace-nowrap"
                        />
                      </div>


                    </div>
                  </div>

                   {/* Coluna 3: Reconciliação Documental Integrada */}
                   <div className="space-y-6">
                     <div className="flex items-center gap-4 whitespace-nowrap">
                       <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2.5">
                         <FileText size={14} className="text-purple-500" />
                         Reconciliação de Documentos
                       </h4>
                       <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                     </div>

                     <div className="bg-white/[0.01] border border-white/5 rounded-[2rem] p-6 space-y-6">
                       <div className="flex items-center justify-between px-2">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-black text-white uppercase tracking-widest">Grade de Documentos</span>
                           <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Séries A501 & G501</span>
                         </div>
                         <div className="flex items-center gap-3">
                           <div className="flex flex-col items-end">
                             <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Integridade</span>
                             <span className="text-[9px] font-bold text-emerald-400 uppercase">Sincronizado</span>
                           </div>
                           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                         </div>
                       </div>
  
                       <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
                         <table className="w-full border-collapse">
                           <thead>
                             <tr className="border-b border-white/10 bg-white/[0.04]">
                               <th className="w-[70px] px-4 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Tipo</th>
                               <th className="px-4 py-4 text-[9px] font-black text-blue-500 uppercase tracking-widest text-center border-l border-white/10">A501</th>
                               <th className="px-4 py-4 text-[9px] font-black text-indigo-500 uppercase tracking-widest text-center border-l border-white/10">G501</th>
                             </tr>
                           </thead>
                           <tbody>
                             {/* Linha da Reserva (Item 01) */}
                             <tr className="border-b border-white/10 bg-blue-500/5 group/row">
                               <td className="px-4 py-6 text-center align-middle border-r border-white/10">
                                 <div className="flex flex-col items-center gap-1">
                                   <span className="text-[10px] font-black text-blue-500 font-mono">01</span>
                                   <span className="text-[7px] font-black text-blue-400/50 uppercase tracking-tighter">Reserva</span>
                                 </div>
                               </td>
                               <td className="p-0">
                                 <input 
                                   name="reserva_a501" 
                                   autoComplete="off"
                                   defaultValue={editingReserva.reserva_a501 || ''}
                                   readOnly={selectedReservas.size > 1 && selectedReservas.has(editingReserva.id)}
                                   className={cn(
                                     "w-full bg-transparent border-none focus:ring-0 px-6 py-8 text-center font-mono text-sm font-black text-blue-400 placeholder:text-blue-400/20 transition-all focus:bg-blue-500/5",
                                     selectedReservas.size > 1 && selectedReservas.has(editingReserva.id) && "opacity-30 cursor-not-allowed"
                                   )}
                                   placeholder={selectedReservas.size > 1 && selectedReservas.has(editingReserva.id) ? "MÚLTIPLOS" : "---"}
                                 />
                               </td>
                               <td className="p-0 border-l border-white/10">
                                 <input 
                                   name="reserva_g501" 
                                   autoComplete="off"
                                   defaultValue={editingReserva.reserva_g501 || ''}
                                   readOnly={selectedReservas.size > 1 && selectedReservas.has(editingReserva.id)}
                                   className={cn(
                                     "w-full bg-transparent border-none focus:ring-0 px-6 py-8 text-center font-mono text-sm font-black text-indigo-400 placeholder:text-indigo-400/20 transition-all focus:bg-indigo-500/5",
                                     selectedReservas.size > 1 && selectedReservas.has(editingReserva.id) && "opacity-30 cursor-not-allowed"
                                   )}
                                   placeholder={selectedReservas.size > 1 && selectedReservas.has(editingReserva.id) ? "MÚLTIPLOS" : "---"}
                                 />
                               </td>
                             </tr>
                             {/* Área de Estornos (Lista Dinâmica via Tabela Excel) */}
                             <tr className="bg-emerald-500/[0.02]">
                               <td className="px-4 py-4 text-center align-top border-r border-white/10">
                                 <div className="flex flex-col items-center gap-1 mt-3">
                                   <span className="text-[10px] font-black text-emerald-500 font-mono tracking-widest">EST</span>
                                   <span className="text-[7px] font-black text-emerald-400/50 uppercase tracking-tighter">Estornos</span>
                                 </div>
                               </td>
                               <td colSpan={2} className="p-0">
                                 {selectedReservas.size > 1 && selectedReservas.has(editingReserva.id) ? (
                                   <div className="p-12 flex flex-col items-center justify-center text-center space-y-3 opacity-40">
                                     <FileText size={40} className="text-emerald-500/50" />
                                     <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Edição de Documentos Bloqueada</p>
                                     <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest max-w-[200px]">Os estornos são individuais por reserva e não podem ser editados em lote.</p>
                                   </div>
                                 ) : (
                                   <>
                                     {/* Hidden inputs to serialize docRows on form submit */}
                                     <input type="hidden" name="estorno_a501" value={docRows.map(r => r.a501).filter(Boolean).join('\n')} readOnly />
                                     <input type="hidden" name="estorno_g501" value={docRows.map(r => r.g501).filter(Boolean).join('\n')} readOnly />

                                     <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                       <table className="w-full border-collapse">
                                         <thead className="sticky top-0 bg-[#0d1117] z-10 shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                                           <tr className="border-b border-white/5">
                                             <th className="w-10 px-3 py-2 text-[8px] font-black text-slate-600 uppercase text-center">#</th>
                                             <th className="px-3 py-2 text-[8px] font-black text-emerald-500 uppercase tracking-widest border-l border-white/5">SÉRIE A501</th>
                                             <th className="px-3 py-2 text-[8px] font-black text-emerald-400 uppercase tracking-widest border-l border-white/5">SÉRIE G501</th>
                                             <th className="w-8"></th>
                                           </tr>
                                         </thead>
                                         <tbody>
                                           {docRows.map((row, idx) => {
                                             const handleDocPaste = (e: React.ClipboardEvent<HTMLInputElement>, startCol: number) => {
                                               const text = e.clipboardData.getData('text');
                                               const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
                                               const isTSV = lines.some(l => l.includes('\t'));
                                               const isCSV = !isTSV && lines.some(l => l.includes(';'));
                                               const isMultiRow = lines.length > 1;
                                               if (!isTSV && !isCSV && !isMultiRow) return;
                                               e.preventDefault();
                                               const sep = isTSV ? '\t' : isCSV ? ';' : null;
                                               const newRows = [...docRows];
                                               lines.forEach((line, lineOffset) => {
                                                 const cells = sep ? line.split(sep).map(c => c.trim()) : [line.trim()];
                                                 const targetIdx = idx + lineOffset;
                                                 while (newRows.length <= targetIdx) newRows.push({ a501: '', g501: '' });
                                                 const cols: (keyof typeof newRows[0])[] = ['a501', 'g501'];
                                                 cells.forEach((val, colOffset) => {
                                                   const colIdx = startCol + colOffset;
                                                   if (colIdx < cols.length) newRows[targetIdx][cols[colIdx]] = val;
                                                 });
                                               });
                                               setDocRows(newRows);
                                             };
                                             return (
                                               <tr key={idx} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors group/row">
                                                 <td className="px-3 py-0 text-[9px] font-mono text-slate-700 text-center">{idx + 1}</td>
                                                 <td className="p-0 border-l border-white/5 relative">
                                                   <input
                                                     value={row.a501}
                                                     onChange={e => { const n = [...docRows]; n[idx].a501 = e.target.value; setDocRows(n); }}
                                                     onPaste={e => handleDocPaste(e, 0)}
                                                     placeholder="A501..."
                                                     className="w-full bg-transparent px-3 py-2 text-[11px] font-mono font-bold text-emerald-500 focus:outline-none focus:bg-emerald-500/5 placeholder:text-emerald-900/30 text-center"
                                                   />
                                                 </td>
                                                 <td className="p-0 border-l border-white/5 relative">
                                                   <input
                                                     value={row.g501}
                                                     onChange={e => { const n = [...docRows]; n[idx].g501 = e.target.value; setDocRows(n); }}
                                                     onPaste={e => handleDocPaste(e, 1)}
                                                     placeholder="G501..."
                                                     className="w-full bg-transparent px-3 py-2 text-[11px] font-mono font-bold text-emerald-400 focus:outline-none focus:bg-emerald-500/5 placeholder:text-emerald-900/30 text-center"
                                                   />
                                                 </td>
                                                 <td className="pr-2 align-middle text-right">
                                                   <button
                                                     type="button"
                                                     onClick={() => setDocRows(docRows.filter((_, i) => i !== idx))}
                                                     className="opacity-0 group-hover/row:opacity-100 transition-opacity text-slate-700 hover:text-rose-500 p-1 rounded hover:bg-rose-500/10"
                                                   >
                                                     <Trash2 size={12} />
                                                   </button>
                                                 </td>
                                               </tr>
                                             );
                                           })}
                                         </tbody>
                                       </table>
                                     </div>
                                     <button
                                       type="button"
                                       onClick={() => setDocRows([...docRows, { a501: '', g501: '' }])}
                                       className="w-full py-2.5 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] hover:text-emerald-500 hover:bg-emerald-500/5 transition-all border-t border-white/5"
                                     >
                                       + Adicionar Linha
                                     </button>
                                   </>
                                 )}
                               </td>
                             </tr>
                           </tbody>
                         </table>
                       </div>
                       
                       <div className="flex items-center justify-between px-3 py-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                         <div className="flex items-center gap-4">
                           <div className="flex flex-col">
                             <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Dica de Uso</span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cole do Excel — a tabela distribui os dados</span>
                           </div>
                         </div>
                         <div className="h-4 w-px bg-white/10" />
                         <div className="flex items-center gap-4">
                           <div className="flex flex-col items-end">
                             <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Auto-Reconciliação</span>
                             <span className="text-[9px] font-bold text-blue-400 uppercase">Ativado</span>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                  </div>
                </form>
              </div>

            {/* Footer fixo com botões - full width */}
            <div className="shrink-0 px-10 pb-10 pt-6 border-t border-white/5 flex gap-4 bg-gradient-to-t from-black/20 to-transparent">
                <button 
                  onClick={() => setEditingReserva(null)}
                  type="button"
                  className="flex-1 py-5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  form="edit-reserva-form"
                  disabled={!user}
                  className={cn(
                    "flex-[2.5] relative group overflow-hidden bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3",
                    !user && "opacity-50 cursor-not-allowed bg-slate-700 hover:bg-slate-700 shadow-none"
                  )}
                >
                  {user ? <Save size={18} /> : <Info size={18} />}
                  {user ? "Salvar Alterações" : "Somente Visualização"}
                </button>
              </div>
            </motion.div>
          </div>
        )}


        {editingLote && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingLote(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                <RefreshCw className="text-blue-600 dark:text-blue-500" /> Editar Status do Lote
              </h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-6">Lote: {editingLote.lote}</p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const statusValue = String(formData.get('status'));
                const embalagensValue = Number(formData.get('embalagens'));
                const { error } = await supabase.from('lotes_config').update({ 
                  status: statusValue,
                  embalagens: embalagensValue
}).eq('lote', editingLote.lote);
            if (!error) {
                  setEditingLote(null);
                  fetchData();
                } else {
                  alert("Erro ao atualizar: " + error.message);
                }
              }} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Total de Embalagens</label>
                    <input 
                      name="embalagens" 
                      type="number" 
                      defaultValue={editingLote.totalEmbalagens} 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" 
                      placeholder="Qtd total do lote" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Status do Lote</label>
                <div className="grid grid-cols-2 gap-2">
  {[
    { id: 'Aguardando', label: 'Aguardando', icon: Hourglass, color: 'amber' },
    { id: 'Em andamento', label: 'Em andamento', icon: PlayCircle, color: 'blue' },
    { id: 'Pausado', label: 'Pausado', icon: PauseCircle, color: 'rose' },
    { id: 'Finalizado', label: 'Finalizado', icon: CheckCircle2, color: 'emerald' },
    { id: 'Em fila', label: 'Em Fila', icon: ListMusic, color: 'violet' },
  ].map((status) => (
    <button
      key={status.id}
      type="button"
      onClick={() => setTempStatus(status.id)}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
        status.id === 'Em fila' && "col-span-2",
        tempStatus === status.id ? `bg-${status.color}-600 text-white border-${status.color}-400 shadow-lg` : "bg-white/5 border-white/10 text-slate-500 hover:bg-white/10"
      )}
    >
      <status.icon size={12} />
      {status.label}
    </button>
  ))}
</div>
                    <input type="hidden" name="status" value={tempStatus} />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setEditingLote(null)} className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white text-[11px] font-black uppercase transition-all">Cancelar</button>
                  <button type="submit" className="flex-2 px-8 py-3 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase shadow-lg shadow-blue-500/20 transition-all">Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isViagemModalOpen && editingViagemGroup && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsViagemModalOpen(false)} 
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className={cn(
                "relative bg-[#0F172A] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-500",
                editingViagemGroup.number ? "w-full max-w-lg" : "w-full max-w-[1000px]"
              )}
            >

              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />
              
              <div className="p-8 overflow-y-auto max-h-[90vh] custom-scrollbar">

                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Truck size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tight">
                        {editingViagemGroup.number && editingViagemGroup.number !== 'SEM_VIAGEM' ? 'Editar Viagem' : 'Nova Viagem'}
                      </h2>
                    </div>

                  </div>
                  <button 
                    onClick={() => setIsViagemModalOpen(false)}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const viagemNum = Number(formData.get('viagem_num'));
                  const viagemDate = formData.get('viagem_date') as string;
                  
                  if (isNaN(viagemNum)) {
                    alert("Por favor, insira um número de viagem válido.");
                    return;
                  }

                  const updateData: any = { numero_da_viagem: viagemNum };
                  if (viagemDate) updateData.enviado_ao_cd = viagemDate;
                  
                  const turnoVal = formData.get('turno_da_viagem');
                  if (turnoVal) updateData.turno_da_viagem = Number(turnoVal);

                  if (!editingViagemGroup.number || editingViagemGroup.number === 'SEM_VIAGEM') {
                    // EXCEL MODE: Bulk Update/Insert
                    const validRows = excelRows.filter(row => row.a501 || row.g501);
                    if (validRows.length === 0) {
                      alert("Insira pelo menos uma reserva na tabela.");
                      return;
                    }

                    if (!selectedLoteDetail) return;

for (const row of validRows) {
  const existing = selectedLoteDetail.items.find(item =>
    (row.a501 && item.reserva_a501 === row.a501) ||
    (row.g501 && item.reserva_g501 === row.g501)
  );

                      if (existing) {
                        await supabase.from('retrabalhos').update(updateData).eq('id', existing.id);
                      } else {
                        await supabase.from('retrabalhos').insert([{
                          ...updateData,
                          reserva_a501: row.a501,
                          reserva_g501: row.g501,
                          quantidade_enviada: Number(row.qtd) || 0,
                          lote: selectedLoteDetail.lote,
                          status: 'EM ANDAMENTO',
                          data_inicio: new Date().toISOString()
                        }]);
                      }
                    }
                  } else {
                    // NORMAL EDIT MODE: Bulk Update
                    const ids = editingViagemGroup.items.map(i => i.id);
                    const { error } = await supabase.from('retrabalhos').update(updateData).in('id', ids);
                    if (error) alert("Erro ao atualizar: " + error.message);
                  }

                  // Cleanup and Refresh
                  fetchData();
                  setIsViagemModalOpen(false);
                  setSelectionMode(false);
                  setSelectedReservas(new Set());
                  setExcelRows(Array.from({ length: 20 }, () => ({ a501: '', g501: '', qtd: '' })));
                }} className="space-y-6">
                  {/* Common Header Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Nº da Viagem</label>
                      <div className="relative group">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-amber-500 transition-colors" />
                        <input 
                          name="viagem_num"
                          type="number"
                          required
                          autoFocus
                          defaultValue={editingViagemGroup.number && editingViagemGroup.number !== "SEM_VIAGEM" ? editingViagemGroup.number : ""}
                          placeholder="Ex: 12345"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-white font-mono focus:outline-none focus:border-amber-500/50 focus:bg-amber-500/5 transition-all no-spinner"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Data de Envio</label>
                      <div className="relative group">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
                        <input 
                          name="viagem_date"
                          type="date"
                          defaultValue={editingViagemGroup.items[0]?.enviado_ao_cd?.split('T')[0] || ""}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-white font-mono focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Turno Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Turno da Viagem</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map((t) => (
                        <label key={t} className="relative group cursor-pointer">
                          <input 
                            type="radio" 
                            name="turno_da_viagem" 
                            value={t}
                            defaultChecked={editingViagemGroup.items[0]?.turno_da_viagem === t}
                            className="peer sr-only" 
                          />
                          <div className="flex items-center justify-center py-3 rounded-xl bg-white/5 border border-white/10 text-slate-500 peer-checked:bg-amber-600 peer-checked:text-white peer-checked:border-amber-400 transition-all font-black text-sm">
                            TURNO {t}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Body: Excel Table for NEW or Summary for EDIT */}
                  {!editingViagemGroup.number || editingViagemGroup.number === 'SEM_VIAGEM' ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Table size={12} /> Tabela de Lançamento
                        </h3>
                        <button 
                          type="button" 
                          onClick={() => setExcelRows(Array.from({ length: 20 }, () => ({ a501: '', g501: '', qtd: '' })))}
                          className="text-[9px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                        >
                          <Trash2 size={12} /> Limpar
                        </button>
                      </div>


                      <div className="border border-white/5 rounded-3xl overflow-hidden bg-black/20 max-h-[40vh] overflow-y-auto custom-scrollbar">

                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white/5">
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-white/5 w-12 text-center">#</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-white/5">Reserva A501</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-white/5">Reserva G501</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Quantidade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {excelRows.map((row, idx) => {
                              // Smart paste handler - works from any cell
                              const handleSmartPaste = (e: React.ClipboardEvent<HTMLInputElement>, startCol: number) => {
                                const text = e.clipboardData.getData('text');
                                const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
                                
                                // Detect if it's multi-column (tab or semicolon separated)
                                const isTSV = lines.some(l => l.includes('\t'));
                                const isCSV = !isTSV && lines.some(l => l.includes(';'));
                                const isMultiCol = isTSV || isCSV;
                                
                                if (!isMultiCol && lines.length === 1) return; // single value, paste normally
                                
                                e.preventDefault();
                                const sep = isTSV ? '\t' : ';';
                                const newRows = [...excelRows];
                                
                                lines.forEach((line, lineOffset) => {
                                  const cells = line.split(sep).map(c => c.trim());
                                  const targetIdx = idx + lineOffset;
                                  
                                  // Expand rows if needed
                                  while (newRows.length <= targetIdx) {
                                    newRows.push({ a501: '', g501: '', qtd: '' });
                                  }
                                  
                                  const cols: (keyof typeof newRows[0])[] = ['a501', 'g501', 'qtd'];
                                  cells.forEach((val, colOffset) => {
                                    const colIdx = startCol + colOffset;
                                    if (colIdx < cols.length) {
                                      newRows[targetIdx][cols[colIdx]] = val;
                                    }
                                  });
                                });
                                
                                setExcelRows(newRows);
                              };

                              return (
                                <tr key={idx} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                                  <td className="px-4 py-1 text-[10px] font-mono font-bold text-slate-600 border-r border-white/5 text-center">{idx + 1}</td>
                                  <td className="px-1 py-1 border-r border-white/5">
                                    <input 
                                      value={row.a501}
                                      onChange={(e) => {
                                        const newRows = [...excelRows];
                                        newRows[idx].a501 = e.target.value;
                                        setExcelRows(newRows);
                                      }}
                                      onPaste={(e) => handleSmartPaste(e, 0)}
                                      placeholder="Digitar..."
                                      className="w-full bg-transparent px-3 py-2 text-[11px] font-mono font-black text-white focus:outline-none placeholder:text-slate-700"
                                    />
                                  </td>
                                  <td className="px-1 py-1 border-r border-white/5">
                                    <input 
                                      value={row.g501}
                                      onChange={(e) => {
                                        const newRows = [...excelRows];
                                        newRows[idx].g501 = e.target.value;
                                        setExcelRows(newRows);
                                      }}
                                      onPaste={(e) => handleSmartPaste(e, 1)}
                                      placeholder="Digitar..."
                                      className="w-full bg-transparent px-3 py-2 text-[11px] font-mono font-black text-white focus:outline-none placeholder:text-slate-700"
                                    />
                                  </td>
                                  <td className="px-1 py-1">
                                    <input 
                                      value={row.qtd}
                                      onChange={(e) => {
                                        const newRows = [...excelRows];
                                        newRows[idx].qtd = e.target.value;
                                        setExcelRows(newRows);
                                      }}
                                      onPaste={(e) => handleSmartPaste(e, 2)}
                                      placeholder="Qtd..."
                                      className="w-full bg-transparent px-3 py-2 text-[11px] font-mono font-black text-white focus:outline-none placeholder:text-slate-700"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setExcelRows([...excelRows, { a501: '', g501: '', qtd: '' }])}
                        className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-widest hover:bg-white/5 hover:text-slate-300 transition-all"
                      >
                        + Adicionar Linha
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Package size={12} /> Itens Afetados
                      </h3>
                      <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                        {editingViagemGroup.items.map(item => (
                          <div key={item.id} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-mono font-bold text-slate-300">
                            {item.reserva_a501 || item.reserva_g501 || `#${item.id}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsViagemModalOpen(false)}
                      className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-amber-600/20 transition-all flex items-center justify-center gap-3"
                    >
                      <Save size={16} />
                      Confirmar Viagem
                    </button>
                  </div>
                </form>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scanner Toast Notification */}
      <AnimatePresence>
        {scanToast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[10001] pointer-events-none"
          >
            <div className={cn(
              "px-8 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-4",
              scanToast.type === 'success' 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                scanToast.type === 'success' ? "bg-emerald-500/20" : "bg-rose-500/20"
              )}>
                {scanToast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Scanner Automático</div>
                <div className="text-sm font-black uppercase tracking-tight">{scanToast.message}</div>
              </div>
              <div className="ml-4 w-1 h-8 rounded-full bg-current opacity-20 animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
