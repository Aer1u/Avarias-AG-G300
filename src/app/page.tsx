// =============================================================================
// SYSTEM: NEXUS ERP — PORTAL CENTRAL DO DASHBOARD
// OWNER:  Platform Owner (Nível 1) & Governança Global
// SCOPE:  Portal principal de entrada para todos os módulos e workspaces
// PURPOSE: Ponto de entrada limpo. Itens administrativos (IAM, Laboratório,
//          banner de administração, cargo do usuário) ocultos por padrão
//          para todos — incluindo o email supremo.
//          Ativar modo desenvolvedor: Ctrl+Shift+D.
// =============================================================================

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  Tv, 
  Fan, 
  LayoutGrid, 
  ArrowRight, 
  FlaskConical, 
  Shield, 
  Crown, 
  Building, 
  UserCheck,
  Code2
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useIAM } from "@/providers/IAMProvider"

interface ModuleCard {
  id: string
  name: string
  badge: string
  subtitle: string
  description: string
  href: string
  icon: React.ReactNode
  devOnly?: boolean
}

export default function HomePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [devMode, setDevMode] = useState(false)

  const { 
    userEmail, 
    userName, 
    authorityLevel, 
    isAuthenticated, 
    isPlatformOwner, 
    isPlatformAdmin 
  } = useIAM()

  const isPrivileged = isPlatformOwner || isPlatformAdmin || authorityLevel === 1 || authorityLevel === 2

  // Ctrl+Shift+D — ativa/desativa modo dev (apenas para privilegiados)
  useEffect(() => {
    if (!isPrivileged) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setDevMode(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isPrivileged])

  useEffect(() => { setMounted(true) }, [])

  const modules: ModuleCard[] = [
    {
      id: "g300",
      name: "G300",
      badge: "Operacional",
      subtitle: "Avarias e Mapeamento G300",
      description: "Controle de saldo, avarias, retrabalho e visualização das ruas do G300.",
      href: "/g300/avarias",
      icon: <Tv size={28} strokeWidth={2} />,
    },
    {
      id: "mkbr",
      name: "MKBR",
      badge: "Operacional",
      subtitle: "Processos da Linha BR",
      description: "Formação de paletes, avarias, conferência e registros da operação BR.",
      href: "/mkbr",
      icon: <Fan size={28} strokeWidth={2} />,
    },
    {
      id: "mapeamentos",
      name: "Mapeamentos",
      badge: "Customizável",
      subtitle: "Mapeamento Livre do Armazém",
      description: "Criação de grades, áreas de chão, blocados e estruturas independentes.",
      href: "/mapeamentos",
      icon: <LayoutGrid size={28} strokeWidth={2} />,
    },
    {
      id: "laboratorio",
      name: "Laboratório",
      badge: "Dev & Testes",
      subtitle: "Área de Testes e Experimentos",
      description: "Ambiente isolado para protótipos, testes e experimentos de novos recursos.",
      href: "/laboratorio",
      icon: <FlaskConical size={28} strokeWidth={2} />,
      devOnly: true,
    },
    {
      id: "iam",
      name: "IAM & Governança",
      badge: "Segurança Global",
      subtitle: "Identidade, Papéis e Tetos Administrativos",
      description: "Console central de governança, autoridade global, workspaces e matriz RBAC.",
      href: "/iam",
      icon: <Shield size={28} strokeWidth={2} />,
      devOnly: true,
    },
  ]

  // Itens devOnly só aparecem quando modo dev está ativo (e usuário é privilegiado)
  const visibleModules = modules.filter(mod => {
    if (mod.devOnly) return devMode && isPrivileged
    return true
  })

  if (!mounted) return null

  const iconBgMap: Record<string, string> = {
    mkbr: "bg-emerald-600",
    g300: "bg-blue-600",
    iam: "bg-amber-600",
    laboratorio: "bg-orange-600",
    mapeamentos: "bg-purple-600",
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800/80 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200 font-bold text-sm shadow-sm">
            AG
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
              NEXUS ERP — Sistema de Gestão de Armazém
            </h2>
            <p className="text-[11px] text-slate-400">
              Plataforma Integrada de Operações Logísticas e Mapeamento
            </p>
          </div>
        </div>

        {/* Status de sessão — sem expor cargo/email por padrão */}
        <div className="flex items-center gap-3">
          {/* Cargo/email visível apenas em modo dev */}
          {devMode && isAuthenticated && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <UserCheck size={14} className="text-emerald-400" />
              <div className="flex flex-col text-right">
                <span className="font-semibold text-slate-200 leading-tight">
                  {userName || userEmail}
                </span>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider",
                  authorityLevel === 1 ? "text-amber-400" :
                  authorityLevel === 2 ? "text-indigo-400" :
                  authorityLevel === 3 ? "text-blue-400" : "text-slate-400"
                )}>
                  {authorityLevel === 1 ? "👑 Proprietário Global" :
                   authorityLevel === 2 ? "🛡️ Administrador Global" :
                   authorityLevel === 3 ? "🏢 Administrador Local" : "👤 Operador"}
                </span>
              </div>
            </div>
          )}

          {/* Indicador online — sempre visível */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 text-xs">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">Online</span>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="max-w-6xl w-full mx-auto py-10 flex-1">

        {/* Banner Admin Global — apenas em modo dev */}
        {devMode && isPrivileged && (
          <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-indigo-950/30 border border-amber-500/30 shadow-lg">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Crown size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Central de Administração Global</h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Modo Dev
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Autoridade global sobre todos os workspaces, permissões e auditoria.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => router.push('/iam')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
                >
                  <Shield size={14} />
                  Abrir Console IAM
                </button>
                <button
                  onClick={() => router.push('/iam')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  <Building size={14} />
                  Workspaces
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
            Selecione o Módulo de Trabalho
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            Acesse os workspaces de estoque, processos operacionais ou ferramentas de configuração.
          </p>
        </div>

        {/* Grade de Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visibleModules.map(mod => (
            <div
              key={mod.id}
              onClick={() => router.push(mod.href)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 flex flex-col justify-between transition-colors cursor-pointer group shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg text-white",
                    iconBgMap[mod.id] ?? "bg-slate-700"
                  )}>
                    <motion.div
                      animate={
                        mod.id === 'mkbr' ? { rotate: 360 } :
                        mod.id === 'g300' ? { scale: [1, 1.1, 1] } :
                        { rotate: [0, 10, -10, 0] }
                      }
                      transition={{
                        repeat: Infinity,
                        duration: mod.id === 'mkbr' ? 2 : 3,
                        ease: "linear"
                      }}
                    >
                      {mod.icon}
                    </motion.div>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/60 text-slate-400">
                    {mod.badge}
                  </span>
                </div>

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

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>© 2026 Armazém Geral • Gestão e Controle Operacional</p>
        <p className="font-mono text-[11px] text-slate-600">NEXUS ERP v2.5</p>
      </footer>

      {/* ── Botão Sutil de Modo Desenvolvedor (apenas Nível 1 ou 2) ── */}
      {isPrivileged && (
        <button
          onClick={() => setDevMode((prev) => !prev)}
          className={cn(
            "fixed bottom-4 right-4 z-40 p-2 rounded-xl border text-xs transition-all flex items-center gap-1.5 backdrop-blur-md shadow-lg",
            devMode
              ? "bg-slate-900/90 border-amber-500/40 text-amber-300 opacity-90 hover:opacity-100"
              : "bg-slate-900/40 border-slate-800/50 text-slate-500 hover:text-slate-300 hover:border-slate-700 opacity-30 hover:opacity-100"
          )}
          title={devMode ? "Ocultar opções de desenvolvimento" : "Opções de desenvolvimento"}
        >
          <Code2 size={15} />
          {devMode && (
            <span className="text-[10px] font-bold uppercase tracking-wider pr-1">
              Dev Ativo
            </span>
          )}
        </button>
      )}
    </div>
  )
}
