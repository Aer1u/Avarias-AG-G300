"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { motion } from "framer-motion"

export default function ConfirmarReserva() {
  const params = useParams()
  const id = params.id
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    async function confirm() {
      if (!id) return
      
      const idArray = (id as string).split(",")
      
      const { error } = await supabase
        .from("retrabalhos")
        .update({ Sistema: true })
        .in("id", idArray)

      if (error) {
        console.error("Erro ao confirmar:", error)
        setStatus("error")
        setMessage(error.message)
      } else {
        setStatus("success")
      }
    }
    confirm()
  }, [id])

  return (
    <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-[3rem] p-12 text-center shadow-[0_0_100px_rgba(0,0,0,0.5)] backdrop-blur-xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 opacity-50" />
        
        {status === "loading" && (
          <div className="py-8">
            <div className="relative w-20 h-20 mx-auto mb-8">
              <Loader2 className="w-20 h-20 text-blue-500 animate-spin absolute inset-0" />
              <div className="absolute inset-0 bg-blue-500/20 blur-xl animate-pulse rounded-full" />
            </div>
            <h1 className="text-2xl font-black text-white mb-3 uppercase tracking-widest">Processando</h1>
            <p className="text-slate-400 text-sm font-medium tracking-wide">Validando bipe do coletor e confirmando no sistema...</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-8">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="relative w-20 h-20 mx-auto mb-8"
            >
              <CheckCircle2 className="w-20 h-20 text-emerald-500 absolute inset-0 z-10" />
              <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full" />
            </motion.div>
            <h1 className="text-3xl font-black text-white mb-3 uppercase tracking-widest">Confirmado!</h1>
            <p className="text-emerald-400/80 text-sm font-black uppercase tracking-widest mb-8">Reserva A501 validada</p>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
              <p className="text-slate-400 text-[11px] font-medium leading-relaxed">
                A confirmação foi registrada com sucesso. O volume está pronto para a próxima etapa do processo.
              </p>
            </div>
            <div className="mt-10 pt-8 border-t border-white/5">
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.3em]">Operação Finalizada</p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="py-8">
            <div className="relative w-20 h-20 mx-auto mb-8">
              <XCircle className="w-20 h-20 text-rose-500 absolute inset-0 z-10" />
              <div className="absolute inset-0 bg-rose-500/30 blur-2xl rounded-full" />
            </div>
            <h1 className="text-2xl font-black text-white mb-3 uppercase tracking-widest">Falha</h1>
            <p className="text-rose-400/80 text-sm font-medium mb-6">{message || "Erro ao processar confirmação"}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
