"use client"

import dynamic from "next/dynamic"
import { ArrowLeft, FlaskConical } from "lucide-react"
import { useRouter } from "next/navigation"

// Konva só roda no browser — importação dinâmica sem SSR
const UniversalMapEditor = dynamic(
  () => import("@/components/laboratorio/UniversalMapEditor"),
  { ssr: false, loading: () => (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
      Carregando motor vetorial e biblioteca autoral...
    </div>
  )}
)

export default function MapeamentoLabPage() {
  const router = useRouter()

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header compacto */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/80 bg-slate-900 shrink-0">
        <button
          onClick={() => router.push("/laboratorio")}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs"
        >
          <ArrowLeft size={14} />
          Lab
        </button>
        <span className="text-slate-700">›</span>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-amber-600 flex items-center justify-center">
            <FlaskConical size={11} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-200">Editor de Mapeamento 2D</span>
        </div>
        <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-500">
          Fase 2
        </span>
      </header>

      {/* Editor ocupa o resto da tela */}
      <UniversalMapEditor />
    </div>
  )
}
