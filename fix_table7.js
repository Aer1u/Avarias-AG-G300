const fs = require('fs');
const filepath = 'src/components/RetrabalhosTab.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

// Fix formatDate
content = content.replace(
  "return new Intl.DateTimeFormat('pt-BR', { \n      day: '2-digit', \n      month: '2-digit',\n      year: '2-digit',\n      hour: '2-digit', \n      minute: '2-digit'\n    }).format(date)",
  "return new Intl.DateTimeFormat('pt-BR', { \n      day: '2-digit', \n      month: '2-digit',\n      year: '2-digit'\n    }).format(date)"
);

// We need to rewrite the table headers and body
const NEW_CONTENT = `              <AnimatePresence>
                {expandedLotes.has(lote.lote) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-[#0A0F1A]">
                    <div className="p-6">
                      <div className="flex items-center gap-4 mb-6">
                           <div className="h-px flex-1 bg-white/5" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Detalhamento de Reservas</span><div className="h-px flex-1 bg-white/5" />
                      </div>

                      <div className="w-full overflow-x-auto no-scrollbar">
                        <div className="min-w-[1100px] border border-white/[0.05] rounded-[2rem] bg-white/[0.02] backdrop-blur-xl overflow-hidden shadow-2xl">
                          
                          {/* Cabeçalho da Tabela */}
                          <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_120px] gap-4 px-6 py-4 bg-white/[0.02] border-b border-white/[0.05] items-center">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Nº</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">A501 / G501</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Estornos</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Data Inicial</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Data Final</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Enviado</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Retornado</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Emb. Avariada</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Peças Rej.</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Status</span>
                          </div>

                          {/* Linhas da Tabela */}
                          <div className="flex flex-col">
                            {lote.items.map((item, idx) => (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                transition={{ delay: idx * 0.03 }} 
                                key={item.id} 
                                className={cn(
                                  "grid grid-cols-[3rem_1fr_1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_120px] gap-4 px-6 py-4 items-center group/row hover:bg-white/[0.02] transition-colors border-b border-white/[0.02] last:border-0 relative"
                                )}
                              >
                                {/* 1. Índice */}
                                <div className="flex justify-center">
                                  <div className="text-[11px] font-black text-slate-500">
                                    {idx + 1}
                                  </div>
                                </div>

                                {/* 2. Reservas A501 / G501 */}
                                <div className="flex items-center justify-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500">A</span>
                                    <span className="text-[11px] font-black text-slate-300 font-mono">{item.reserva_a501 || "---"}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500">G</span>
                                    <span className="text-[11px] font-black text-slate-300 font-mono">{item.reserva_g501 || "---"}</span>
                                  </div>
                                </div>

                                {/* 3. Estornos */}
                                <div className="flex items-center justify-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500">A</span>
                                    <span className="text-[11px] font-black text-slate-300 font-mono">{item.estorno_a501 || "---"}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500">G</span>
                                    <span className="text-[11px] font-black text-slate-300 font-mono">{item.estorno_g501 || "---"}</span>
                                  </div>
                                </div>

                                {/* 4. Data Início */}
                                <div className="flex items-center justify-center">
                                  <span className="text-[11px] font-bold text-slate-300 font-mono tracking-wider">{formatDate(item.data_inicio)}</span>
                                </div>

                                {/* 5. Data Fim */}
                                <div className="flex items-center justify-center">
                                  {item.data_fim ? (
                                    <span className="text-[11px] font-bold text-slate-300 font-mono tracking-wider">{formatDate(item.data_fim)}</span>
                                  ) : (
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Pendente</span>
                                  )}
                                </div>

                                {/* 6. Enviado */}
                                <div className="flex items-center justify-center">
                                  <span className="text-[12px] font-black text-slate-200 font-mono">{item.quantidade_enviada}</span>
                                </div>
                                
                                {/* 7. Retornado */}
                                <div className="flex items-center justify-center">
                                  <span className="text-[12px] font-black text-emerald-400 font-mono">{item.quantidade_retornada}</span>
                                </div>
                                
                                {/* 8. Avariada */}
                                <div className="flex items-center justify-center">
                                  <span className="text-[12px] font-black text-amber-400 font-mono">{item.embalagens_avariadas || 0}</span>
                                </div>
                                
                                {/* 9. Rejeitado */}
                                <div className="flex items-center justify-center">
                                  <span className="text-[12px] font-black text-rose-400 font-mono">{item.quantidade_rejeitada || 0}</span>
                                </div>

                                {/* 10. Status & Actions */}
                                <div className="flex items-center justify-center gap-3 relative">
                                  {item.status?.toUpperCase() === 'FINALIZADO' && (!item.estorno_a501 && !item.estorno_g501) && (
                                    <div className="absolute right-[110%] flex items-center justify-center">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-ping" />
                                    </div>
                                  )}
                                  
                                  <div className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-wider",
                                    getStatusConfig(item.status).style
                                  )}>
                                    <div className={cn("w-1 h-1 rounded-full", getStatusConfig(item.status).dot)} />
                                    {item.status}
                                  </div>

                                  {user && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingReserva(item);
                                        setTempStatus(item.status);
                                      }}
                                      className="opacity-0 group-hover/row:opacity-100 transition-opacity absolute -right-8 p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400"
                                    >
                                      <RefreshCw size={12} />
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>`;

let s = content.indexOf('groupedData.map((lote, index) => (');
let t = content.indexOf('<AnimatePresence>', s);
let e = content.indexOf('</AnimatePresence>', t) + '</AnimatePresence>'.length;

if (t !== -1 && e !== -1) {
  let finalContent = content.substring(0, t) + NEW_CONTENT + content.substring(e);
  fs.writeFileSync(filepath, finalContent, 'utf-8');
  console.log("Clean layout updated successfully!");
} else {
  console.log("Indices not found");
}
