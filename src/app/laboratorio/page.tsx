"use client"

import { useState, useEffect } from "react"
import { FlaskConical, ArrowLeft, Map, Lock, ShieldAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface LabExperiment {
  id: string
  name: string
  description: string
  href: string
  badge: string
  icon: React.ReactNode
  color: string
}

export default function LaboratorioPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setCheckingAuth(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setCheckingAuth(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (checkingAuth) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="animate-spin">⏳</span>
          <span>Verificando credenciais de acesso...</span>
        </div>
      </div>
    )
  }

  // 🔒 Bloqueio: O Laboratório só é acessível para usuários autenticados
  if (!session?.user) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-amber-950/50 border border-amber-800/60 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
          <Lock size={32} />
        </div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 mb-1">
          Acesso Restrito
        </span>
        <h1 className="text-xl font-bold text-white mb-2">
          Ambiente Exclusivo para Usuários Autenticados
        </h1>
        <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
          O <strong>Laboratório</strong> e o <strong>Editor de Mapeamento Universal</strong> são protegidos e requerem autenticação ativa para visualização e edição estrutural.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          <span>Voltar à Página Inicial</span>
        </button>
      </div>
    )
  }

  const experiments: LabExperiment[] = [
    {
      id: "mapeamento",
      name: "Editor de Mapeamento 2D",
      description: "Canvas com Konva.js — desenho de ambientes, grades e posições.",
      href: "/laboratorio/mapeamento",
      badge: "Fase 2",
      icon: <Map size={20} />,
      color: "bg-blue-600",
    },
  ]

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col p-6 md:p-12">
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
              <FlaskConical size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Laboratório</h2>
              <p className="text-[11px] text-slate-500">Área de Testes e Experimentos</p>
            </div>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-800/40 text-amber-400">
          Dev
        </span>
      </header>

      {/* Conteúdo */}
      <main className="max-w-6xl w-full mx-auto flex-1 py-12">
        <div className="mb-10">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">Experimentos</h1>
          <p className="text-slate-400 text-sm">Protótipos em construção para o Nexus ERP.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {experiments.map(exp => (
            <div
              key={exp.id}
              onClick={() => router.push(exp.href)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-5 cursor-pointer transition-colors group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-9 h-9 rounded-lg ${exp.color} flex items-center justify-center text-white`}>
                  {exp.icon}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                  {exp.badge}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{exp.name}</h3>
              <p className="text-xs text-slate-500">{exp.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-600">
        <p>Laboratório • Nexus ERP</p>
        <p className="font-mono text-[11px]">lab/v0.1</p>
      </footer>
    </div>
  )
}
