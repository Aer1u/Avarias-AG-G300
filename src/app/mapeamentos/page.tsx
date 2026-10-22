"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  Plus,
  Download,
  Settings,
  MapPin,
  Table as TableIcon,
  Search,
  Warehouse,
} from "lucide-react"
import * as XLSX from "xlsx"
import { AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import {
  MapeamentoConfig,
  MapeamentoItem,
  MapeamentoPosicao,
  COLOR_THEMES,
  fetchMapeamentoConfigs,
  saveMapeamentoConfig,
  deleteMapeamento,
  fetchMapeamentoItens,
  saveMapeamentoItem,
  deleteMapeamentoItem,
  fetchMapeamentoPosicoes,
  saveMapeamentoPosicao,
  bulkSaveMapeamentoPosicoes,
  deleteMapeamentoPosicao,
} from "@/lib/mapeamentosStorage"
import { MapeamentoConfigModal } from "@/components/mapeamentos/MapeamentoConfigModal"
import { MapeamentoPositionPanel } from "@/components/mapeamentos/MapeamentoPositionPanel"
import { MapeamentoItemModal } from "@/components/mapeamentos/MapeamentoItemModal"
import { MapeamentoWarehouseMap } from "@/components/mapeamentos/MapeamentoWarehouseMap"
import { MapeamentoTable } from "@/components/mapeamentos/MapeamentoTable"
import { MapeamentoEmptyState } from "@/components/mapeamentos/MapeamentoEmptyState"
import { MapeamentoPosicaoModal } from "@/components/mapeamentos/MapeamentoPosicaoModal"

export default function MapeamentosPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Dados da plataforma
  const [configs, setConfigs] = useState<MapeamentoConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [items, setItems] = useState<MapeamentoItem[]>([])

  // Posições cadastradas pelo usuário para este mapeamento (Chão, Drive-In, etc.)
  const [posicoes, setPosicoes] = useState<MapeamentoPosicao[]>([])

  // Filtros e modo de exibição
  const [search, setSearch] = useState("")
  const [ruaFiltro, setRuaFiltro] = useState<string>("TODAS")
  const [displayMode, setDisplayMode] = useState<"mapa" | "tabela">("mapa")

  // Modais
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [configParaEditar, setConfigParaEditar] = useState<MapeamentoConfig | null>(null)

  const [isPosicaoModalOpen, setIsPosicaoModalOpen] = useState(false)

  // Posição selecionada (padrão G300: selectedPosId em vez de modal state)
  const [selectedPosId, setSelectedPosId] = useState<string | null>(null)

  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [itemCoords, setItemCoords] = useState<{ lvl: number; prof: number }>({ lvl: 1, prof: 1 })
  const [itemParaEditar, setItemParaEditar] = useState<MapeamentoItem | null>(null)

  // Carrega configurações, itens e posições físicas
  useEffect(() => {
    setMounted(true)
    loadAllData()
  }, [])

  // Carrega posições específicas quando o mapeamento selecionado muda
  useEffect(() => {
    if (selectedConfigId) {
      loadPosicoesParaMapeamento(selectedConfigId)
    } else {
      setPosicoes([])
    }
  }, [selectedConfigId])

  const loadAllData = async () => {
    setIsLoading(true)
    try {
      const [cfgs, its] = await Promise.all([
        fetchMapeamentoConfigs(),
        fetchMapeamentoItens(),
      ])
      setConfigs(cfgs)
      setItems(its)

      let activeId = selectedConfigId
      if (cfgs.length > 0 && !activeId) {
        activeId = cfgs[0].id
        setSelectedConfigId(activeId)
      }

      if (activeId) {
        await loadPosicoesParaMapeamento(activeId)
      }
    } catch (err) {
      console.warn("Erro ao carregar dados:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPosicoesParaMapeamento = async (cfgId: string) => {
    try {
      const data = await fetchMapeamentoPosicoes(cfgId)
      setPosicoes(data)
    } catch (err) {
      console.warn("Erro ao carregar posições do mapeamento:", err)
      setPosicoes([])
    }
  }

  const activeConfig = useMemo(() => {
    return configs.find(c => c.id === selectedConfigId) || null
  }, [configs, selectedConfigId])

  const activeTheme = useMemo(() => {
    if (!activeConfig) return COLOR_THEMES.blue
    return COLOR_THEMES[activeConfig.cor] || COLOR_THEMES.blue
  }, [activeConfig])

  // Itens do mapeamento ativo
  const activeItems = useMemo(() => {
    if (!selectedConfigId) return []
    return items.filter(it => it.mapeamentoId === selectedConfigId)
  }, [items, selectedConfigId])

  // Mapa de itens por posição no mapeamento ativo
  const itemsByPosicao = useMemo(() => {
    const map = new Map<string, MapeamentoItem[]>()
    activeItems.forEach(it => {
      if (!map.has(it.posicao)) map.set(it.posicao, [])
      map.get(it.posicao)!.push(it)
    })
    return map
  }, [activeItems])

  // Detalhe da posição selecionada — padrão G300 (positionDetail)
  const selectedPosDetail = useMemo(() => {
    if (!selectedPosId) return null
    const pos = posicoes.find(p => p.codigo === selectedPosId || p.id === selectedPosId)
    const posItems = activeItems.filter(it => it.posicao === selectedPosId)
    const capacidade = pos?.capacidade || 16
    const nivel_count = pos?.nivelCount ?? (pos?.tipo === "chao" ? 1 : 3)
    const prof_count = pos?.profundidadeCount ?? (pos?.tipo === "chao" ? capacidade : 4)
    return {
      posicao: selectedPosId,
      capacidade,
      nivel_count,
      prof_count,
      is_blocked: pos?.status === "Bloqueado",
      observacao: pos?.observacao || "",
      items: posItems,
      occupied: posItems.length,
      isOverflow: posItems.length > capacidade,
    }
  }, [selectedPosId, posicoes, activeItems])

  // Setores e Ruas disponíveis para filtro
  const setoresDisponiveis = useMemo(() => {
    const set = new Set<string>()
    posicoes.forEach(p => {
      if (p.setor) {
        set.add(p.setor)
      } else {
        const match = (p.codigo || "").match(/([0-9][A-Z])(\d+)/i)
        if (match) set.add(`Rua ${match[1].toUpperCase()}`)
        else set.add("Geral")
      }
    })
    return Array.from(set).sort()
  }, [posicoes])

  // Processamento de Posições (Ruas com Lado Par/Ímpar E Áreas de Chão/Blocados)
  const { streetData, areaData } = useMemo(() => {
    const streets: Record<string, { even: any[]; odd: any[] }> = {}
    const areas: Record<string, any[]> = {}
    const posMap = new Map<string, any>()

    posicoes.forEach(p => {
      const posId = p.codigo
      if (!posId) return

      const posItems = itemsByPosicao.get(posId) || []

      if (search) {
        const term = search.toLowerCase()
        const matchesPos = posId.toLowerCase().includes(term)
        const matchesItem = posItems.some(
          it =>
            it.sku.toLowerCase().includes(term) ||
            it.descricao.toLowerCase().includes(term) ||
            (it.idPalete && it.idPalete.toLowerCase().includes(term))
        )
        if (!matchesPos && !matchesItem) return
      }

      if (ruaFiltro !== "TODAS") {
        const match = posId.match(/([0-9][A-Z])(\d+)/i)
        const ruaPrefix = match ? match[1].toUpperCase() : null
        const isMatchRua = ruaPrefix === ruaFiltro || `Rua ${ruaPrefix}` === ruaFiltro
        const isMatchSetor = p.setor === ruaFiltro
        if (!isMatchRua && !isMatchSetor) {
          return
        }
      }

      const posData = {
        id: posId,
        posIdReal: p.id,
        tipo: p.tipo,
        setor: p.setor || (p.tipo === "chao" ? "Área de Chão" : "Geral"),
        paletes: posItems.length,
        capacidade: p.capacidade || 16,
        is_blocked: p.status === "Bloqueado",
        status: p.status || "Aberto",
        observacao_pos: p.observacao,
        nivel_count: p.nivelCount ?? (p.tipo === "chao" ? 1 : 3),
        profundidade_count: p.profundidadeCount ?? (p.tipo === "chao" ? p.capacidade : 4),
        products: posItems.map(it => ({
          id: it.id,
          sku: it.sku,
          descricao: it.descricao,
          quantidade: it.quantidade,
          nivel: it.nivel,
          profundidade: it.profundidade,
          id_palete: it.idPalete,
          customValues: it.customValues,
        })),
      }

      posMap.set(posId, posData)
    })

    posMap.forEach((p, id) => {
      const match = id.match(/([0-9][A-Z])(\d+)/i)
      // Se for padrão de rua (ex: 01F0011 ou 1F001) e tipo drive_in ou porta_palete
      if (match && p.tipo !== "chao") {
        const prefix = match[1].toUpperCase()
        const fullNumStr = match[2]
        const bayNum = parseInt(fullNumStr.substring(0, 3))
        const isEven = bayNum % 2 === 0
        const side = isEven ? "even" : "odd"

        if (!streets[prefix]) {
          streets[prefix] = { even: [], odd: [] }
        }
        streets[prefix][side].push(p)
      } else {
        // Áreas de chão, blocados ou posições livres agrupadas por setor
        const areaName = p.setor || (p.tipo === "chao" ? "Área de Chão" : "Outras Posições")
        if (!areas[areaName]) {
          areas[areaName] = []
        }
        areas[areaName].push(p)
      }
    })

    const sortPos = (arr: any[]) =>
      arr.sort((a, b) => {
        const matchA = a.id.match(/([0-9][A-Z])(\d+)/i)
        const matchB = b.id.match(/([0-9][A-Z])(\d+)/i)
        if (matchA && matchB) {
          return parseInt(matchA[2]) - parseInt(matchB[2])
        }
        return a.id.localeCompare(b.id, undefined, { numeric: true })
      })

    Object.values(streets).forEach(s => {
      if ("even" in s) sortPos(s.even)
      if ("odd" in s) sortPos(s.odd)
    })

    Object.values(areas).forEach(arr => sortPos(arr))

    return { streetData: streets, areaData: areas }
  }, [posicoes, itemsByPosicao, search, ruaFiltro])

  // Estatísticas avançadas do armazém (Ruas + Áreas de Chão)
  const advancedStats = useMemo(() => {
    const allStreetPositions = Object.values(streetData).flatMap(s => [...s.even, ...s.odd])
    const allAreaPositions = Object.values(areaData).flat()
    const allPositions = [...allStreetPositions, ...allAreaPositions]
    const active = allPositions.filter(p => !p.is_blocked)

    const globalCap = active.reduce((acc, p) => acc + (p.capacidade || 0), 0)
    const globalUso = active.reduce((acc, p) => acc + (p.paletes || 0), 0)
    const globalLivre = Math.max(0, globalCap - globalUso)
    const globalOccupancy = globalCap > 0 ? (globalUso / globalCap) * 100 : 0

    const lotadoCount = active.filter(p => p.capacidade > 0 && p.paletes >= p.capacidade).length
    const disponivelCount = active.filter(p => p.paletes > 0 && p.paletes < p.capacidade).length
    const vazioCount = active.filter(p => p.paletes === 0).length

    return {
      globalCap,
      globalUso,
      globalLivre,
      globalOccupancy,
      lotadoCount,
      disponivelCount,
      vazioCount,
    }
  }, [streetData, areaData])

  // ── AÇÕES ─────────────────────────────────────────────────────────────────

  const handleCreateOrUpdateConfig = async (newConfig: MapeamentoConfig) => {
    await saveMapeamentoConfig(newConfig)
    const updated = await fetchMapeamentoConfigs()
    setConfigs(updated)
    setSelectedConfigId(newConfig.id)
    setIsConfigModalOpen(false)
    setConfigParaEditar(null)
  }

  const handleDeleteConfig = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este mapeamento e todos os seus itens?")) {
      await deleteMapeamento(id)
      const updated = await fetchMapeamentoConfigs()
      setConfigs(updated)
      if (selectedConfigId === id) {
        setSelectedConfigId(updated.length > 0 ? updated[0].id : null)
      }
      setItems(await fetchMapeamentoItens())
      setPosicoes([])
    }
  }

  const handleSaveItem = async (input: MapeamentoItem | MapeamentoItem[]) => {
    const list = Array.isArray(input) ? input : [input]
    // Atualização otimista
    setItems(prev => {
      const ids = new Set(list.map(i => i.id))
      const filtered = prev.filter(p => !ids.has(p.id))
      return [...filtered, ...list]
    })
    for (const item of list) {
      await saveMapeamentoItem(item)
    }
    const updated = await fetchMapeamentoItens(selectedConfigId || undefined)
    setItems(updated)
    setIsItemModalOpen(false)
    setItemParaEditar(null)
  }

  const handleDeleteItem = async (itemId: string) => {
    await deleteMapeamentoItem(itemId)
    const updated = await fetchMapeamentoItens(selectedConfigId || undefined)
    setItems(updated)
  }

  const handleSavePosicao = async (pos: MapeamentoPosicao) => {
    // Atualização otimista imediata
    setPosicoes(prev => {
      const idx = prev.findIndex(p => p.id === pos.id || p.codigo === pos.codigo)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = pos
        return copy
      }
      return [...prev, pos]
    })
    await saveMapeamentoPosicao(pos)
    if (selectedConfigId) {
      await loadPosicoesParaMapeamento(selectedConfigId)
    }
  }

  const handleBulkSavePosicoes = async (posList: MapeamentoPosicao[]) => {
    // Atualização otimista imediata
    setPosicoes(prev => {
      const newCodes = new Set(posList.map(p => p.codigo))
      const filtered = prev.filter(p => !newCodes.has(p.codigo))
      return [...filtered, ...posList]
    })
    await bulkSaveMapeamentoPosicoes(posList)
    if (selectedConfigId) {
      await loadPosicoesParaMapeamento(selectedConfigId)
    }
  }

  const handleDeletePosicao = async (posId: string) => {
    // Atualização otimista imediata
    setPosicoes(prev => prev.filter(p => p.id !== posId))
    await deleteMapeamentoPosicao(posId)
    if (selectedConfigId) {
      await loadPosicoesParaMapeamento(selectedConfigId)
    }
  }

  const handleOpenDriveIn = (posId: string) => {
    setSelectedPosId(posId)
  }

  const handleExportExcel = () => {
    if (!activeConfig) return

    const rows = activeItems.map(it => {
      const rowData: Record<string, any> = {
        Mapeamento: activeConfig.nome,
        Categoria: activeConfig.categoria,
        Posição: it.posicao,
        Nível: it.nivel,
        Profundidade: it.profundidade,
        "Id Palete": it.idPalete || "",
        "Código SKU": it.sku,
        Descrição: it.descricao,
        Quantidade: it.quantidade,
        "Data de Registro": new Date(it.criadoEm).toLocaleString("pt-BR"),
      }

      activeConfig.camposPersonalizados.forEach(field => {
        rowData[field.nome] = it.customValues?.[field.id] ?? ""
      })

      return rowData
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mapeamento")
    const safeName = activeConfig.nome.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()
    XLSX.writeFile(workbook, `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const [view, setView] = useState<"list" | "detail">(configs.length > 0 ? "list" : "list")
  
  // Atualiza a visualização para 'list' se não houver seleção
  useEffect(() => {
    if (!selectedConfigId) {
        setView("list")
    }
  }, [selectedConfigId])

  if (!mounted) return null

  // Estado vazio: nenhum mapeamento cadastrado
  if (configs.length === 0 && !isLoading) {
    return (
      <>
        <MapeamentoEmptyState
          onBackToHome={() => router.push("/")}
          onCreateFirst={() => {
            setConfigParaEditar(null)
            setIsConfigModalOpen(true)
          }}
        />
        <MapeamentoConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onSave={handleCreateOrUpdateConfig}
          initialConfig={configParaEditar}
        />
      </>
    )
  }

  // Visualização de Listagem
  if (view === "list") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <div className="max-w-4xl mx-auto">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mapeamentos</h1>
                    <p className="text-slate-500 text-sm">Selecione um mapeamento para iniciar</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => router.push("/")} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400">Voltar</button>
                    <button 
                        onClick={() => { setConfigParaEditar(null); setIsConfigModalOpen(true) }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl"
                    >
                        Novo Mapeamento
                    </button>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {configs.map(c => (
                    <div 
                        key={c.id} 
                        onClick={() => { setSelectedConfigId(c.id); setView("detail") }}
                        className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-blue-500 transition-colors"
                    >
                        <h3 className="font-bold text-lg">{c.nome}</h3>
                        <p className="text-slate-500 text-sm">{c.categoria}</p>
                    </div>
                ))}
            </div>
        </div>
        <MapeamentoConfigModal
            isOpen={isConfigModalOpen}
            onClose={() => setIsConfigModalOpen(false)}
            onSave={handleCreateOrUpdateConfig}
            initialConfig={configParaEditar}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100">
      {/* ── HEADER SUPERIOR ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-8 py-3.5 transition-colors">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Lado Esquerdo: Voltar + Seletor de Mapeamento */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("list")}
              title="Voltar à lista de mapeamentos"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold cursor-pointer shrink-0"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Mapeamentos</span>
            </button>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{activeConfig?.nome}</div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPosicaoModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold cursor-pointer shadow-sm"
            >
              <Warehouse size={14} className="text-amber-500" />
              <span>Posições / Chão</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ─────────────────────────────────────────────── */}
      <main className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Alternador de Modo: MAPA vs TABELA */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit border border-slate-200/50 dark:border-slate-800/50">
            <button
              onClick={() => setDisplayMode("mapa")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-semibold transition-all cursor-pointer",
                displayMode === "mapa"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <MapPin size={14} /> MAPA
            </button>
            <button
              onClick={() => setDisplayMode("tabela")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-semibold transition-all cursor-pointer",
                displayMode === "tabela"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <TableIcon size={14} /> TABELA ({activeItems.length})
            </button>
          </div>

        {/* Legenda de Status idêntica ao G300 */}
          {displayMode === "mapa" && (
            <div className="hidden lg:flex items-center justify-center gap-8 px-6">
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  VAZIO <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.vazioCount}</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[#2D5A27] shadow-[0_0_8px_rgba(45,90,39,0.4)]" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  DISPONÍVEL <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.disponivelCount}</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[#991b1b] shadow-[0_0_8px_rgba(153,27,27,0.4)]" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  LOTADO <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.lotadoCount}</span>
                </span>
              </div>
            </div>
          )}

          {/* Busca e Filtro de Rua/Setor */}
          <div className="flex items-center gap-3">
            <div className="relative min-w-[200px] md:min-w-[240px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar SKU, palete, posição..."
                className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={ruaFiltro}
              onChange={e => setRuaFiltro(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="TODAS">Todos os Setores / Ruas</option>
              {setoresDisponiveis.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        {displayMode === "mapa" && (
          <MapeamentoWarehouseMap
            streetData={streetData}
            areaData={areaData}
            advancedStats={advancedStats}
            activeConfig={activeConfig}
            onOpenDriveIn={handleOpenDriveIn}
            onOpenAddPosicao={() => setIsPosicaoModalOpen(true)}
          />
        )}
        {displayMode === "tabela" && (
          <MapeamentoTable
            activeConfig={activeConfig}
            items={activeItems}
            onOpenDriveIn={handleOpenDriveIn}
            onEditItem={it => {
              setSelectedPosId(it.posicao)
              setItemParaEditar(it)
              setItemCoords({ lvl: it.nivel, prof: it.profundidade })
              setIsItemModalOpen(true)
            }}
            onDeleteItem={handleDeleteItem}
            onExportExcel={handleExportExcel}
          />
        )}
      </main>

      {/* ── MODAIS ───────────────────────────────────────────────────────── */}
      <MapeamentoConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => {
          setIsConfigModalOpen(false)
          setConfigParaEditar(null)
        }}
        onSave={handleCreateOrUpdateConfig}
        initialConfig={configParaEditar}
      />

      {/* Modal para criar ou gerenciar posições do mapeamento (Chão, Drive-In) */}
      {isPosicaoModalOpen && activeConfig && (
        <MapeamentoPosicaoModal
          isOpen={isPosicaoModalOpen}
          onClose={() => setIsPosicaoModalOpen(false)}
          config={activeConfig}
          posicoesAtuais={posicoes}
          onSavePosicao={handleSavePosicao}
          onBulkSavePosicoes={handleBulkSavePosicoes}
          onDeletePosicao={handleDeletePosicao}
        />
      )}

      {/* Painel de posição Drive-In ou Chão — idêntico ao G300 (backdrop + panel grande) */}
      <AnimatePresence>
        {selectedPosId && selectedPosDetail && activeConfig && (
          <MapeamentoPositionPanel
            posDetail={selectedPosDetail}
            config={activeConfig}
            onClose={() => setSelectedPosId(null)}
            onAddItem={(lvl, prof) => {
              setItemCoords({ lvl, prof })
              setItemParaEditar(null)
              setIsItemModalOpen(true)
            }}
            onEditItem={it => {
              setItemParaEditar(it)
              setItemCoords({ lvl: it.nivel, prof: it.profundidade })
              setIsItemModalOpen(true)
            }}
            onDeleteItem={handleDeleteItem}
          />
        )}
      </AnimatePresence>

      {isItemModalOpen && activeConfig && (
        <MapeamentoItemModal
          isOpen={isItemModalOpen}
          onClose={() => {
            setIsItemModalOpen(false)
            setItemParaEditar(null)
          }}
          onSave={handleSaveItem}
          posicao={selectedPosId || posicoes[0]?.codigo || ""}
          posicoesDisponiveis={posicoes.map(p => p.codigo)}
          nivelInicial={itemCoords.lvl}
          profundidadeInicial={itemCoords.prof}
          config={activeConfig}
          itemParaEditar={itemParaEditar}
        />
      )
      }
    </div>
  )
}

