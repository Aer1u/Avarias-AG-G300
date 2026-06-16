"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { CheckCircle2, AlertCircle, Loader2, PackageCheck } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState("Processando confirmação...")

  useEffect(() => {
    if (!id) {
      setStatus('error')
      setMessage("ID não encontrado no QR Code.")
      return
    }

    const confirmDelivery = async () => {
      try {
        const now = new Date();
        const isoDate = now.toISOString().split('T')[0];

        const { data, error, status: responseStatus } = await supabase
          .from('retrabalhos')
          .update({ 
            Sistema: true,
            situacao: 'Entregues ao conserto',
            enviado_ao_conserto: isoDate
          })
          .eq('id', id)
          .select()

        if (error) {
          console.error('Supabase Error:', error)
          setStatus('error')
          if (error.code === '42501' || responseStatus === 403) {
            setMessage("Erro de Permissão: O banco de dados bloqueou a atualização anônima. Verifique as políticas de RLS.")
          } else {
            setMessage(`Erro no banco: ${error.message}`)
          }
          return
        }

        if (!data || data.length === 0) {
          setStatus('error')
          setMessage(`Item #${id} não encontrado ou nenhuma alteração permitida.`)
          return
        }

        setStatus('success')
        setMessage(`Entrega do item #${id} confirmada com sucesso!`)
      } catch (err) {
        console.error('System Error:', err)
        setStatus('error')
        setMessage("Erro crítico ao processar confirmação.")
      }
    }

    confirmDelivery()
  }, [id])

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans">
      <AnimatePresence mode="wait">
        {status === 'loading' && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center space-y-4"
          >
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Validando ID: {id}</p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div 
            key="success"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm"
          >
            <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-[2.5rem] p-10 text-center shadow-[0_0_100px_rgba(16,185,129,0.15)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent" />
              <div className="relative z-10">
                <div className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/40 transform -rotate-3">
                  <CheckCircle2 size={48} className="text-white" />
                </div>
                <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Confirmado!</h1>
                <p className="text-emerald-400/80 font-bold uppercase tracking-widest text-[10px] mb-6">Status: Entregue ao Conserto</p>
                
                <div className="bg-black/20 rounded-2xl py-4 px-6 border border-white/5 inline-block mb-8">
                   <span className="text-white font-mono font-black text-xl">ITEM #{id}</span>
                </div>

                <button 
                  onClick={() => {
                    setStatus('loading');
                    setMessage("Aguardando novo scan...");
                    // Se estiver em um dispositivo que permite, podemos limpar o ID da URL
                    window.history.replaceState({}, '', window.location.pathname);
                  }}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white/40 hover:text-white font-black uppercase tracking-widest text-[9px] transition-all border border-white/5 flex items-center justify-center gap-3"
                >
                  <Loader2 size={14} className="animate-spin-slow" />
                  Reiniciar Scanner
                </button>
                
                <div className="mt-8 pt-8 border-t border-emerald-500/10">
                  <div className="flex items-center justify-center gap-2 text-emerald-500/40">
                    <PackageCheck size={16} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Sincronizado com G300</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div 
            key="error"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm"
          >
            <div className="bg-rose-500/10 border-2 border-rose-500/20 rounded-[2.5rem] p-10 text-center shadow-[0_0_100px_rgba(244,63,94,0.15)]">
              <div className="w-24 h-24 bg-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-rose-500/40 transform rotate-3">
                <AlertCircle size={48} className="text-white" />
              </div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Erro</h1>
              <p className="text-rose-400 font-bold text-sm mb-6">{message}</p>
              
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] transition-all border border-white/10"
              >
                Tentar Novamente
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ConfirmarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  )
}
