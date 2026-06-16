const fs = require('fs');
const filepath = 'src/components/RetrabalhosTab.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

const NEW_CONTENT = `              <AnimatePresence>
                {expandedLotes.has(lote.lote) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-[#0A0F1A]">
                    <div className="px-6 py-4">
                      
                      {/* Sub-tabela com design limpo inspirado no screenshot */}
                      <div className="w-full overflow-x-auto no-scrollbar">
                        <div className="min-w-[1100px] bg-transparent">
                          
                          {/* Cabeçalho da Tabela */}
                          <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_120px] gap-4 px-4 py-3 border-b border-white/[0.05] items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nº</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">A501 / G501</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estornos</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Inicial</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Final</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enviado</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Retornado</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Emb. Avariada</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Peças Rej.</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</span>
                          </div>

                          {/* Linhas da Tabela */}
                          <div className="flex flex-col">
                            {lote.items.map((item, idx) => (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                transition={{ delay: idx * 0.03 }} 
                                key={item.id} 
                                className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_120px] gap-4 px-4 py-4 items-center group/row hover:bg-white/[0.01] transition-colors border-b border-white/[0.03] last:border-0 relative"
                              >
                                {/* 1. Índice */}
                                <div className="flex items-center">
                                  <span className="text-[12px] font-semibold text-slate-300">
                                    {idx + 1}
                                  </span>
                                </div>

                                {/* 2. Reservas A501 / G501 */}
                                <div className="flex flex-col gap-1 justify-center">
                                  {item.reserva_a501 ? (
                                    <div className="flex items-center gap-1.5 text-slate-300">
                                      <span className="text-[10px] font-bold text-slate-500">A</span>
                                      <span className="text-[12px] font-medium font-mono">{item.reserva_a501}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-slate-300">
                                      <span className="text-[10px] font-bold text-slate-500">A</span>
                                      <span className="text-[12px] font-medium text-blue-500">—</span>
                                    </div>
                                  )}
                                  
                                  {item.reserva_g501 ? (
                                    <div className="flex items-center gap-1.5 text-slate-300">
                                      <span className="text-[10px] font-bold text-slate-500">G</span>
                                      <span className="text-[12px] font-medium font-mono">{item.reserva_g501}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-slate-300">
                                      <span className="text-[10px] font-bold text-slate-500">G</span>
                                      <span className="text-[12px] font-medium text-blue-500">—</span>
                                    </div>
                                  )}
                                </div>

                                {/* 3. Estornos */}
                                <div className="flex flex-col gap-1 justify-center">
                                  {item.estorno_a501 ? (
                                    <div className="flex items-center gap-1.5 text-slate-300">
                                      <span className="text-[10px] font-bold text-slate-500">A</span>
                                      <span className="text-[12px] font-medium font-mono">{item.estorno_a501}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-slate-300">
                                      <span className="text-[10px] font-bold text-slate-500">A</span>
                                      <span className="text-[12px] font-medium text-blue-500">—</span>
                                    </div>
                                  )}
                                  
                                  {item.estorno_g501 ? (
                                    <div className="flex items-center gap-1.5 text-slate-300">
                                      <span className="text-[10px] font-bold text-slate-500">G</span>
                                      <span className="text-[12px] font-medium font-mono">{item.estorno_g501}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-slate-300">
                                      <span className="text-[10px] font-bold text-slate-500">G</span>
                                      <span className="text-[12px] font-medium text-blue-500">—</span>
                                    </div>
                                  )}
                                </div>

                                {/* 4. Data Início */}
                                <div className="flex items-center">
                                  <span className="text-[12px] font-medium text-slate-300 font-mono tracking-wider">{formatDate(item.data_inicio)}</span>
                                </div>

                                {/* 5. Data Fim */}
                                <div className="flex items-center">
                                  {item.data_fim ? (
                                    <span className="text-[12px] font-medium text-slate-300 font-mono tracking-wider">{formatDate(item.data_fim)}</span>
                                  ) : (
                                    <span className="text-[12px] font-medium text-slate-500 font-mono">—</span>
                                  )}
                                </div>

                                {/* 6. Enviado */}
                                <div className="flex items-center">
                                  {item.quantidade_enviada ? (
                                    <span className="text-[12px] font-medium text-slate-200 font-mono">{item.quantidade_enviada}</span>
                                  ) : (
                                    <span className="text-[12px] font-medium text-blue-500 font-mono">—</span>
                                  )}
                                </div>
                                
                                {/* 7. Retornado */}
                                <div className="flex items-center">
                                  {item.quantidade_retornada ? (
                                    <span className="text-[12px] font-medium text-emerald-400 font-mono">{item.quantidade_retornada}</span>
                                  ) : (
                                    <span className="text-[12px] font-medium text-blue-500 font-mono">—</span>
                                  )}
                                </div>
                                
                                {/* 8. Avariada */}
                                <div className="flex items-center">
                                  {item.embalagens_avariadas ? (
                                    <span className="text-[12px] font-medium text-amber-400 font-mono">{item.embalagens_avariadas}</span>
                                  ) : (
                                    <span className="text-[12px] font-medium text-blue-500 font-mono">—</span>
                                  )}
                                </div>
                                
                                {/* 9. Rejeitado */}
                                <div className="flex items-center">
                                  {item.quantidade_rejeitada ? (
                                    <span className="text-[12px] font-medium text-rose-400 font-mono">{item.quantidade_rejeitada}</span>
                                  ) : (
                                    <span className="text-[12px] font-medium text-blue-500 font-mono">—</span>
                                  )}
                                </div>

                                {/* 10. Status & Actions */}
                                <div className="flex items-center relative">
                                  <div className={cn(
                                    "flex items-center gap-1.5 text-[11px] font-semibold tracking-wide",
                                    getStatusConfig(item.status).style.replace('border', '').replace('px-3', '').replace('py-1.5', '').replace('rounded-xl', '')
                                  )}>
                                    {item.status}
                                  </div>

                                  {user && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingReserva(item);
                                        setTempStatus(item.status);
                                      }}
                                      className="opacity-0 group-hover/row:opacity-100 transition-opacity absolute right-4 p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400"
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
  console.log("Updated to match new clean table style!");
} else {
  console.log("Indices not found");
}
