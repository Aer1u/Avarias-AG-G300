"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Tv, Fan, LayoutGrid, ArrowRight } from "lucide-react"

interface ModuleCard {
  id: string
  name: string
  badge: string
  subtitle: string
  description: string
  href: string
  accentColor: string
  iconBg: string
  iconColor: string
  icon: React.ReactNode
}

export default function HomePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const modules: ModuleCard[] = [
    {
      id: "g300",
      name: "G300",
      badge: "Operacional",
      subtitle: "Avarias e Mapeamento G300",
      description: "Controle de saldo, avarias, retrabalho e visualização das ruas do G300.",
      href: "/g300/avarias",
      accentColor: "#3b82f6",
      iconBg: "bg-blue-950/40 border border-blue-800/40",
      iconColor: "text-blue-400",
      icon: <Tv size={28} strokeWidth={2} />,
    },
    {
      id: "mkbr",
      name: "MKBR",
      badge: "Operacional",
      subtitle: "Processos da Linha BR",
      description: "Formação de paletes, avarias, conferência e registros da operação BR.",
      href: "/mkbr",
      accentColor: "#10b981",
      iconBg: "bg-emerald-950/40 border border-emerald-800/40",
      iconColor: "text-emerald-400",
      icon: <Fan size={28} strokeWidth={2} />,
    },
    {
      id: "mapeamentos",
      name: "Mapeamentos",
      badge: "Customizável",
      subtitle: "Mapeamento Livre do Armazém",
      description: "Criação de grades, áreas de chão, blocados e estruturas independentes.",
      href: "/mapeamentos",
      accentColor: "#8b5cf6",
      iconBg: "bg-purple-950/40 border border-purple-800/40",
      iconColor: "text-purple-400",
      icon: <LayoutGrid size={28} strokeWidth={2} />,
    },
  ]

  if (!mounted) return null

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12">
      {/* Header Superior Limpo 2D */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 font-bold text-sm">
            AG
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Sistema de Gestão de Armazém
            </h2>
            <p className="text-[11px] text-slate-500">
              Plataforma Integrada de Operações Logísticas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-400 font-medium">Sistemas Online</span>
        </div>
      </header>

      {/* Conteúdo Central: Seleção de Módulos 2D */}
      <main className="max-w-6xl w-full mx-auto py-12">
        <div className="mb-10">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
            Selecione o Módulo de Trabalho
          </h1>
          <p className="text-sm text-slate-400 max-w-xl">
            Escolha o ambiente operacional que deseja gerenciar. Você pode alternar entre eles a qualquer momento pelo menu superior.
          </p>
        </div>

        {/* Grade de Módulos Estilo 2D Flat */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map(mod => (
            <div
              key={mod.id}
              onClick={() => router.push(mod.href)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 flex flex-col justify-between transition-colors cursor-pointer group"
            >
              <div>
                {/* Topo do card: Ícone 2D + Badge */}
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${mod.iconBg} ${mod.iconColor}`}>
                    {mod.icon}
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/60 text-slate-400">
                    {mod.badge}
                  </span>
                </div>

                {/* Título e Descrição */}
                <h3 className="text-xl font-bold text-white tracking-tight mb-1 group-hover:text-blue-400 transition-colors">
                  {mod.name}
                </h3>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  {mod.subtitle}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {mod.description}
                </p>
              </div>

              {/* Botão de Acesso 2D Flat */}
              <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                <span>Acessar Módulo</span>
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer 2D */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>© 2026 Armazém Geral • Gestão e Controle Operacional</p>
        <p className="font-mono text-[11px] text-slate-600">v2.5.0-clean</p>
      </footer>
    </div>
  )
}
