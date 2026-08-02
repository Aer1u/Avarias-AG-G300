"use client"

import React from "react"
import { motion } from "framer-motion"
import { BarChart3, Wrench, Clock } from "lucide-react"

interface PosAvaria {
  id: number
  posicao: string
  codigo: string
  descricao: string
  estoque: number
  quantidade: number
}

interface DashboardTabProps {
  controleRaw: any[]
  posicoesRaw: PosAvaria[]
}

export default function DashboardTab({ controleRaw, posicoesRaw }: DashboardTabProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[480px] select-none">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-6 text-center max-w-sm"
      >
        {/* Icon cluster */}
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800/80 border border-slate-700/60 shadow-xl">
            <BarChart3 size={34} className="text-slate-500" />
          </div>
          {/* Badge */}
          <motion.div
            animate={{ rotate: [0, -6, 6, -6, 0] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
            className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30"
          >
            <Wrench size={14} className="text-amber-400" />
          </motion.div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-lg font-black text-slate-300 tracking-tight">
            Em Desenvolvimento
          </h2>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            O painel de análises está sendo construído.<br />
            Em breve aqui.
          </p>
        </div>

        {/* Status pill */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/60 border border-slate-700/50">
          <Clock size={12} className="text-slate-500" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Em breve</span>
        </div>
      </motion.div>
    </div>
  )
}
