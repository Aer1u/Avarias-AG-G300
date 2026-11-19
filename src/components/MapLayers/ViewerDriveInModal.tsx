// ============================================================
// NEXUS ERP — MapLayers / ViewerDriveInModal.tsx
// Modal Drive-In Grid Oficial idêntico ao Monitoramento / Mapeamento do G300
// - Header com MapPin, código, ocupação e botão Editar (apenas para Admin)
// - Seletor de canais individuais para o Drive-In
// - Grid de Paletes 100% interativo com drag-and-drop, dashboard e inspeção
// ============================================================

"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MapPin, Printer, X, AlertCircle } from "lucide-react"
import type { MapObject } from "../MapLibrary/types"
import { DriveInGrid } from "@/components/g300/DriveInGrid"
import { supabase } from "@/lib/supabase"

interface ChannelInfo {
  id: string
  code: string
  name: string
  laneIndex?: number
  levels?: number
  depth?: number
  capacity?: number
  occupancy?: number
  status?: string
}

interface ViewerDriveInModalProps {
  isOpen: boolean
  onClose: () => void
  object: MapObject | null
  initialChannelId?: string
  isAdmin: boolean
}

export default function ViewerDriveInModal({
  isOpen,
  onClose,
  object,
  initialChannelId,
  isAdmin,
}: ViewerDriveInModalProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>("")
  const [dbProducts, setDbProducts] = useState<any[]>([])
  const [pendingChanges, setPendingChanges] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Extrai canais cadastrados no drive
  const channels: ChannelInfo[] = useMemo(() => {
    if (!object?.props?.channels || !Array.isArray(object.props.channels)) {
      return []
    }
    return object.props.channels as ChannelInfo[]
  }, [object])

  // Define canal ativo ao abrir
  useEffect(() => {
    if (!isOpen || !object) return

    if (initialChannelId) {
      setSelectedChannelId(initialChannelId)
    } else if (channels.length > 0) {
      setSelectedChannelId(String(channels[0].code || channels[0].id))
    } else {
      setSelectedChannelId(String(object.props?.code || object.label || object.id))
    }
  }, [isOpen, object, initialChannelId, channels])

  // Canal atualmente selecionado
  const currentChannel = useMemo(() => {
    return channels.find(c => c.code === selectedChannelId || c.id === selectedChannelId) || null
  }, [channels, selectedChannelId])

  // Código efetivo da posição
  const effectivePositionCode = useMemo<string>(() => {
    if (currentChannel) {
      return String(currentChannel.code || currentChannel.name || selectedChannelId)
    }
    return String(object?.props?.code || object?.label || object?.id || "")
  }, [currentChannel, selectedChannelId, object])

  const levelCount = Number(currentChannel?.levels || object?.props?.levels) || 4
  const depthCount = Number(currentChannel?.depth || object?.props?.depth) || 4
  const capacity = Number(currentChannel?.capacity || object?.props?.capacity) || (levelCount * depthCount)

  // Busca produtos vinculados à posição no Supabase (tabela mapeamento)
  const fetchPositionData = useCallback(async () => {
    if (!effectivePositionCode) return
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from("mapeamento")
        .select("*")
        .eq("Posição", effectivePositionCode)

      if (error) {
        console.warn("Erro ao buscar dados do mapeamento:", error.message)
        setDbProducts([])
      } else if (data) {
        const mapped = data.map((row: any) => ({
          id: row.Id || row.id,
          sku: row["Código"] || row.sku || "",
          descricao: row["Descrição"] || row.descricao || "",
          nivel: Number(row["Nível"] ?? row.nivel ?? 0),
          profundidade: Number(row["Profundidade"] ?? row.profundidade ?? 1),
          quantidade: Number(row["Quantidade"] ?? row.quantidade ?? 0),
          paletes: Number(row["Paletes"] ?? row.paletes ?? 1),
          qtd_por_palete: Number(row["Qtd Palete"] ?? row.qtd_por_palete ?? 0),
          qtd_tombada: Number(row["Parte Tombada"] ?? row.qtd_tombada ?? 0),
          qtd_molhado: Number(row["Parte Molhada"] ?? row.qtd_molhado ?? 0),
          id_palete: row["Id Palete"] || row.id_palete,
          classificacao: row["Classificação"] || row.classificacao,
        }))
        setDbProducts(mapped)
      }
    } catch (err) {
      console.error("Falha na consulta ao mapeamento:", err)
      setDbProducts([])
    } finally {
      setLoading(false)
    }
  }, [effectivePositionCode])

  useEffect(() => {
    if (isOpen && effectivePositionCode) {
      fetchPositionData()
      setPendingChanges([])
    }
  }, [isOpen, effectivePositionCode, fetchPositionData])

  // Salvar alterações pendentes no banco
  const handleEditSuccess = async () => {
    if (pendingChanges.length === 0) return

    for (const change of pendingChanges) {
      try {
        if (change.type === "UPDATE" && change.payload) {
          await supabase
            .from("mapeamento")
            .update(change.payload)
            .eq("Id", change.id)
        } else if (change.type === "ADD" && change.payload) {
          await supabase
            .from("mapeamento")
            .insert([change.payload])
        } else if (change.type === "DELETE") {
          await supabase
            .from("mapeamento")
            .delete()
            .eq("Id", change.id)
        }
      } catch (e) {
        console.error("Erro salvando alteração de mapeamento:", e)
      }
    }
    setPendingChanges([])
    fetchPositionData()
  }

  if (!isOpen || !object) return null

  const occupiedCount = dbProducts.reduce((sum, p) => sum + (p.paletes || 1), 0)
  const isOverflow = occupiedCount > capacity

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 transition-colors">
        {/* Backdrop com blur escuro */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Principal — IDÊNTICO AO G300 */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-7xl max-h-[96vh] md:max-h-[92vh] rounded-3xl md:rounded-[3rem] bg-slate-900 p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-800 flex flex-col overflow-y-auto md:overflow-hidden custom-scrollbar text-white"
        >
          {/* ── HEADER DO DRIVE-IN ────────────────────────────────────────── */}
          <div className="flex flex-row items-center justify-between gap-2 mb-3 md:mb-6 shrink-0">
            {/* Esquerda: Ícone MapPin azul + Título e Métricas */}
            <div className="flex items-center gap-3 md:gap-4">
              <div className="h-10 w-10 md:h-14 md:w-14 rounded-2xl md:rounded-3xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-900/30 transition-all shrink-0">
                <MapPin size={18} className="md:w-6 md:h-6" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-3xl font-light text-white transition-colors leading-tight font-mono">
                    {effectivePositionCode}
                  </h3>
                  {currentChannel?.name && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {currentChannel.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                  <span className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-[0.15em]">
                    {occupiedCount} / {capacity} PALETES • {levelCount} NÍVEIS (0-{levelCount - 1})
                  </span>
                  {isOverflow && (
                    <span className="flex items-center gap-1 rounded-full bg-red-900/40 px-2 py-0.5 text-[9px] font-semibold uppercase text-red-400 border border-red-800/60">
                      <AlertCircle size={10} /> Excesso
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Direita: Ações (Imprimir, Editar e Fechar) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                title="Imprimir Mapa de Mapeamento"
                className="h-9 px-3 md:h-11 md:px-5 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 transition-all border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs font-semibold uppercase tracking-wider shadow-sm"
              >
                <Printer size={15} />
                <span className="hidden sm:inline">Imprimir Mapa</span>
              </button>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    const event = new CustomEvent("trigger-drivein-edit")
                    window.dispatchEvent(event)
                  }}
                  title="Habilitar Modo Edição e Movimentação"
                  className="h-9 px-3 md:h-11 md:px-6 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 transition-all border bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-600/30 text-xs font-bold uppercase tracking-wider"
                >
                  <span>Editar</span>
                </button>
              ) : (
                <span className="h-9 px-3 md:h-11 md:px-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-1.5 border bg-indigo-950/60 text-indigo-400 border-indigo-800/50 text-[11px] font-bold uppercase tracking-wider">
                  <span>👁️</span>
                  <span className="hidden sm:inline">Visualização</span>
                </span>
              )}

              <button
                type="button"
                onClick={onClose}
                className="h-9 w-9 md:h-11 md:w-11 rounded-xl md:rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all border border-slate-700"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── BARRA DE SELEÇÃO DE CANAIS (se houver múltiplos) ───────────── */}
          {channels.length > 0 && (
            <div className="flex items-center gap-1.5 pb-3 border-b border-slate-800 overflow-x-auto custom-scrollbar shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pr-2 shrink-0">
                Canais do Drive:
              </span>
              {channels.map((chan) => {
                const isSelected = (chan.code || chan.id) === selectedChannelId
                return (
                  <button
                    key={chan.id}
                    type="button"
                    onClick={() => setSelectedChannelId(chan.code || chan.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shrink-0 ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20"
                        : "bg-slate-800/70 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className="text-sm">📥</span>
                    <span className="font-mono">{chan.code}</span>
                    {chan.name && <span className="opacity-70 text-[10px]">({chan.name})</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── CORPO: GRID DO DRIVE-IN COM DASHBOARD INTEGRADO ───────────── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 pt-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs gap-3">
                <span className="animate-spin text-2xl">⏳</span>
                <span>Carregando dados do Drive-In...</span>
              </div>
            ) : (
              <DriveInGrid
                positionId={effectivePositionCode}
                products={dbProducts}
                capacity={capacity}
                levelCount={levelCount}
                isBlocked={false}
                observation={object.props?.observation as string || ""}
                onEditSuccess={handleEditSuccess}
                availableStocks={[]}
                mapeamentoData={dbProducts}
                pendingChanges={pendingChanges}
                setPendingChanges={setPendingChanges}
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
