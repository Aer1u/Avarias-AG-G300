"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ChevronLeft } from "lucide-react"

interface SubModule {
  id: string
  label: string
  description: string
  href: string
  disabled?: boolean
  badge?: string
}

const subModules: SubModule[] = [
  {
    id: "avarias",
    label: "Avarias BR",
    description: "Dashboard, formação de paletes e registros de avarias da BR.",
    href: "/br",
  },
  {
    id: "processos",
    label: "Processos BR",
    description: "Gestão de processos internos da BR.",
    href: "#",
    disabled: true,
    badge: "Em breve",
  },
]

export default function MkbrHubPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(135deg, #07090f 0%, #0b0f1a 100%)" }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 35% at 50% -5%, rgba(16,185,129,0.09) 0%, transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-lg px-6 py-12 flex flex-col gap-10">

        <motion.button
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs font-semibold uppercase tracking-widest transition-colors cursor-pointer w-fit"
        >
          <ChevronLeft size={14} /> Módulos
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-1"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Módulo</p>
          <h1 className="text-3xl font-black text-emerald-400 tracking-tight">MKBR</h1>
          <p className="text-slate-500 text-sm">Processos da BR — selecione o sistema.</p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {subModules.map((sub, i) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              {sub.disabled ? (
                <div className="flex items-center justify-between px-5 py-4 rounded-xl border border-slate-800/50 bg-slate-900/30 opacity-40 cursor-not-allowed">
                  <div>
                    <p className="text-sm font-semibold text-slate-400">{sub.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{sub.description}</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-500 uppercase tracking-wider flex-shrink-0 ml-4">
                    {sub.badge}
                  </span>
                </div>
              ) : (
                <motion.button
                  onHoverStart={() => setHovered(sub.id)}
                  onHoverEnd={() => setHovered(null)}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => router.push(sub.href)}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-xl text-left cursor-pointer transition-all duration-200"
                  style={{
                    background: hovered === sub.id ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${hovered === sub.id ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.06)"}`,
                    boxShadow: hovered === sub.id ? "0 0 24px rgba(16,185,129,0.12)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  <div>
                    <p className="text-sm font-bold text-slate-200">{sub.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sub.description}</p>
                  </div>
                  <motion.svg
                    animate={{ x: hovered === sub.id ? 3 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-4 h-4 text-emerald-400 flex-shrink-0 ml-4"
                    fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </motion.svg>
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
