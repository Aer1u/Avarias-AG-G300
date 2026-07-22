const fs = require('fs');
const filepath = 'src/components/RetrabalhosTab.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

// 1. Update the submit handler to include data_fim
const oldData = `                const data = {
                  quantidade_retornada: Number(formData.get('quantidade_retornada')),
                  quantidade_rejeitada: Number(formData.get('quantidade_rejeitada')),
                  embalagens_avariadas: Number(formData.get('embalagens_avariadas')),
                  estorno_a501: String(formData.get('estorno_a501')),
                  estorno_g501: String(formData.get('estorno_g501')),
                  status: String(formData.get('status'))
                };`;

const newData = `                const data = {
                  quantidade_retornada: Number(formData.get('quantidade_retornada')),
                  quantidade_rejeitada: Number(formData.get('quantidade_rejeitada')),
                  embalagens_avariadas: Number(formData.get('embalagens_avariadas')),
                  estorno_a501: String(formData.get('estorno_a501')),
                  estorno_g501: String(formData.get('estorno_g501')),
                  status: String(formData.get('status')),
                  data_fim: formData.get('data_fim') ? new Date(String(formData.get('data_fim'))).toISOString() : null
                };`;

content = content.replace(oldData, newData);

// 2. Add the Date field and improve professional look
const oldFields = `<div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 block text-center">Retrabalhado</label>
                    <input name="quantidade_retornada" defaultValue={editingReserva.quantidade_retornada} required type="number" className="no-spinner w-full bg-slate-50 dark:bg-black/40 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 font-mono text-center text-lg focus:outline-none focus:border-emerald-500/50 transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 block text-center">Rejeitado</label>
                    <input name="quantidade_rejeitada" defaultValue={editingReserva.quantidade_rejeitada} required type="number" className="no-spinner w-full bg-slate-50 dark:bg-black/40 border border-rose-500/20 rounded-xl px-4 py-3 text-rose-400 font-mono text-center text-lg focus:outline-none focus:border-rose-500/50 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1.5 block text-center">Embalagens Avariadas</label>
                  <input name="embalagens_avariadas" defaultValue={editingReserva.embalagens_avariadas} required type="number" className="no-spinner w-full bg-slate-50 dark:bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 font-mono text-center text-lg focus:outline-none focus:border-amber-500/50 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Estorno A501</label>
                    <input name="estorno_a501" defaultValue={editingReserva.estorno_a501} className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" placeholder="OP Estorno" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Estorno G501</label>
                    <input name="estorno_g501" defaultValue={editingReserva.estorno_g501} className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" placeholder="OP Estorno" />
                  </div>
                </div>`;

const newFields = `<div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-500/5 dark:bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 block text-center">Retrabalhado</label>
                    <input name="quantidade_retornada" defaultValue={editingReserva.quantidade_retornada} required type="number" className="no-spinner w-full bg-transparent border-b-2 border-emerald-500/20 rounded-none px-2 py-1 text-emerald-400 font-mono text-center text-2xl focus:outline-none focus:border-emerald-500 transition-all" />
                  </div>
                  <div className="bg-rose-500/5 dark:bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2 block text-center">Rejeitado</label>
                    <input name="quantidade_rejeitada" defaultValue={editingReserva.quantidade_rejeitada} required type="number" className="no-spinner w-full bg-transparent border-b-2 border-rose-500/20 rounded-none px-2 py-1 text-rose-400 font-mono text-center text-2xl focus:outline-none focus:border-rose-500 transition-all" />
                  </div>
                </div>

                <div className="bg-amber-500/5 dark:bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10">
                  <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 block text-center">Embalagens Avariadas</label>
                  <input name="embalagens_avariadas" defaultValue={editingReserva.embalagens_avariadas} required type="number" className="no-spinner w-full bg-transparent border-b-2 border-amber-500/20 rounded-none px-2 py-1 text-amber-400 font-mono text-center text-2xl focus:outline-none focus:border-amber-500 transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Estorno A501</label>
                    <input name="estorno_a501" defaultValue={editingReserva.estorno_a501} className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-blue-500/50 transition-all" placeholder="OP Estorno" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Estorno G501</label>
                    <input name="estorno_g501" defaultValue={editingReserva.estorno_g501} className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-blue-500/50 transition-all" placeholder="OP Estorno" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Data de Finalização</label>
                  <input name="data_fim" type="date" defaultValue={editingReserva.data_fim ? new Date(editingReserva.data_fim).toISOString().split('T')[0] : ''} className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-blue-500/50 transition-all [color-scheme:dark]" />
                </div>`;

content = content.replace(oldFields, newFields);

fs.writeFileSync(filepath, content, 'utf-8');
console.log("Professionalized Update Modal and added Finish Date field!");
