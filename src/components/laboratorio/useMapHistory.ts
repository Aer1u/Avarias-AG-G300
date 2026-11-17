// ============================================================
// NEXUS ERP — laboratorio / useMapHistory.ts
// Gerenciador de Histórico de Desfazer e Refazer (Undo / Redo)
// Suporte a atalhos de teclado (Ctrl+Z / Ctrl+Y) e histórico ilimitado
// ============================================================

import { useState, useCallback } from "react"
import type { MapObject } from "../MapLibrary/types"

interface HistoryState {
  past: MapObject[][]
  present: MapObject[]
  future: MapObject[][]
}

export function useMapHistory(initialPresent: MapObject[] = []) {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: initialPresent,
    future: [],
  })

  // Registra nova alteração no histórico
  const setObjectsWithHistory = useCallback((newObjectsOrUpdater: MapObject[] | ((prev: MapObject[]) => MapObject[])) => {
    setHistory((curr) => {
      const nextPresent =
        typeof newObjectsOrUpdater === "function"
          ? newObjectsOrUpdater(curr.present)
          : newObjectsOrUpdater

      // Evita duplicatas se o estado for idêntico
      if (curr.present === nextPresent) return curr

      return {
        past: [...curr.past.slice(-30), curr.present], // Mantém até 30 passos
        present: nextPresent,
        future: [],
      }
    })
  }, [])

  // Desfazer (Ctrl+Z)
  const undo = useCallback(() => {
    setHistory((curr) => {
      if (curr.past.length === 0) return curr
      const previous = curr.past[curr.past.length - 1]
      const newPast = curr.past.slice(0, curr.past.length - 1)
      return {
        past: newPast,
        present: previous,
        future: [curr.present, ...curr.future],
      }
    })
  }, [])

  // Refazer (Ctrl+Y / Ctrl+Shift+Z)
  const redo = useCallback(() => {
    setHistory((curr) => {
      if (curr.future.length === 0) return curr
      const next = curr.future[0]
      const newFuture = curr.future.slice(1)
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture,
      }
    })
  }, [])

  // Substitui estado sem registrar no histórico (ex: carga de template)
  const resetHistory = useCallback((newPresent: MapObject[]) => {
    setHistory({
      past: [],
      present: newPresent,
      future: [],
    })
  }, [])

  return {
    objects: history.present,
    setObjects: setObjectsWithHistory,
    resetHistory,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
