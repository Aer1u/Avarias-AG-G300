"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Pencil, Trash2, Check, RefreshCw, GripVertical, Settings2 } from "lucide-react"
import { AvariaTipo, hexToStyle, saveAvariaTipos, useAvariaTipos } from "@/hooks/useAvariaTipos"

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ")
}

interface Props {
  open: boolean
  onClose: () => void
}

const PRESET_COLORS = [
  "#10b981", "#14b8a6", "#f59e0b", "#a855f7", "#3b82f6",
  "#ef4444", "#ec4899", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#8b5cf6", "#64748b", "#d97706", "#dc2626",
]

// Local editable version (includes inactive, used only inside manager)
interface EditableTipo extends AvariaTipo {
  _key: number  // local unique key for list operations
}

export default function AvariaTiposManager({ open, onClose }: Props) {
  const { tipos, loading, refresh } = useAvariaTipos()

  // Full local list (all active types shown and editable)
  const [localTipos, setLocalTipos] = useState<EditableTipo[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [editingKey, setEditingKey] = useState<number | null>(null)
  const [editNome, setEditNome] = useState("")
  const [editCor, setEditCor] = useState("#10b981")
  const [editLabel, setEditLabel] = useState("")

  const [showAdd, setShowAdd] = useState(false)
  const [newNome, setNewNome] = useState("")
  const [newCor, setNewCor] = useState("#10b981")
  const [newLabel, setNewLabel] = useState("")

  // Sync from fetched tipos when modal opens
  useEffect(() => {
    if (open && !loading) {
      setLocalTipos(
        tipos.map((t, i) => ({ ...t, ativo: t.ativo !== false, _key: i }))
      )
      setIsDirty(false)
    }
  }, [open, tipos, loading])

  const startEdit = (t: EditableTipo) => {
    setEditingKey(t._key)
    setEditNome(t.nome)
    setEditCor(t.cor_hex)
    setEditLabel(t.label || "")
  }

  const cancelEdit = () => {
    setEditingKey(null)
  }

  const applyEdit = () => {
    if (!editNome.trim()) return
    setLocalTipos(prev =>
      prev.map(t =>
        t._key === editingKey
          ? { ...t, nome: editNome.trim().toUpperCase(), cor_hex: editCor, label: editLabel.trim() || null }
          : t
      )
    )
    setIsDirty(true)
    setEditingKey(null)
  }

  const handleRemove = (key: number) => {
    setLocalTipos(prev => prev.filter(t => t._key !== key))
    setIsDirty(true)
  }

  const handleAdd = () => {
    if (!newNome.trim()) return
    const nextKey = localTipos.length > 0 ? Math.max(...localTipos.map(t => t._key)) + 1 : 0
    setLocalTipos(prev => [
      ...prev,
      {
        nome: newNome.trim().toUpperCase(),
        cor_hex: newCor,
        label: newLabel.trim() || null,
        ativo: true,
        ordem: prev.length,
        _key: nextKey
      }
    ])
    setIsDirty(true)
    setShowAdd(false)
    setNewNome("")
    setNewCor("#10b981")
    setNewLabel("")
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      const toSave: AvariaTipo[] = localTipos.map((t, i) => ({
        nome: t.nome,
        cor_hex: t.cor_hex,
        label: t.label || null,
        ativo: true,
        ordem: i,
      }))
      await saveAvariaTipos(toSave)
      refresh()
      setIsDirty(false)
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            className="relative w-full max-w-lg rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Settings2 size={16} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Tipos de Avaria</h3>
                </div>
              </div>
              <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={20} className="animate-spin text-amber-500" />
                </div>
              ) : (
                <>
                  {localTipos.map((tipo) => (
                    <motion.div
                      key={tipo._key}
                      layout
                      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden"
                    >
                      {editingKey === tipo._key ? (
                        <div className="p-3 space-y-3">
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              value={editNome}
                              onChange={e => setEditNome(e.target.value)}
                              placeholder="Nome (ex: AG)"
                              className="flex-1 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                            />
                            <input
                              value={editLabel}
                              onChange={e => setEditLabel(e.target.value)}
                              placeholder="Label curto"
                              className="w-32 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Cor</p>
                            <div className="flex flex-wrap gap-2">
                              {PRESET_COLORS.map(c => (
                                <button key={c} onClick={() => setEditCor(c)}
                                  className={cn("h-7 w-7 rounded-full border-2 transition-all cursor-pointer", editCor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent")}
                                  style={{ backgroundColor: c }} />
                              ))}
                              <input type="color" value={editCor} onChange={e => setEditCor(e.target.value)}
                                className="h-7 w-7 rounded-full cursor-pointer border-2 border-transparent" />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={cancelEdit} className="px-3 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 cursor-pointer">Cancelar</button>
                            <button onClick={applyEdit} className="px-4 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                              <Check size={12} /> Aplicar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <GripVertical size={14} className="text-slate-300 dark:text-slate-700 shrink-0" />
                          <div className="h-5 w-5 rounded-full shrink-0" style={{ backgroundColor: tipo.cor_hex }} />
                          <div className="flex-1 min-w-0">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider" style={hexToStyle(tipo.cor_hex)}>
                              {tipo.nome}
                            </span>
                            {tipo.label && <span className="ml-2 text-[10px] text-slate-400">{tipo.label}</span>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => startEdit(tipo)} className="h-7 w-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors cursor-pointer">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleRemove(tipo._key)} className="h-7 w-7 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors cursor-pointer">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Add new */}
                  <AnimatePresence>
                    {showAdd ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 overflow-hidden"
                      >
                        <div className="p-3 space-y-3">
                          <div className="flex gap-2">
                            <input autoFocus value={newNome} onChange={e => setNewNome(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()}
                              placeholder="Nome do tipo (ex: NOVO)" className="flex-1 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500" />
                            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                              placeholder="Label curto" className="w-32 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Cor</p>
                            <div className="flex flex-wrap gap-2">
                              {PRESET_COLORS.map(c => (
                                <button key={c} onClick={() => setNewCor(c)}
                                  className={cn("h-7 w-7 rounded-full border-2 transition-all cursor-pointer", newCor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent")}
                                  style={{ backgroundColor: c }} />
                              ))}
                              <input type="color" value={newCor} onChange={e => setNewCor(e.target.value)} className="h-7 w-7 rounded-full cursor-pointer" />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowAdd(false)} className="px-3 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">Cancelar</button>
                            <button onClick={handleAdd} disabled={!newNome.trim()} className="px-4 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                              <Plus size={12} /> Adicionar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <button onClick={() => setShowAdd(true)}
                        className="w-full h-10 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 hover:border-amber-300 hover:text-amber-500 dark:hover:border-amber-800 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        <Plus size={14} /> Novo tipo
                      </button>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-end gap-3">
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                  Fechar
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={!isDirty || isSaving}
                  className={cn(
                    "px-5 h-9 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all",
                    isDirty && !isSaving
                      ? "bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                  Salvar tudo
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
