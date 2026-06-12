const fs = require('fs');
const path = 'src/components/RetrabalhosTab.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Change formatDate
const oldFormatDate = `  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(date).replace(',', '')
  }`;

const newFormatDate = `  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit'
    }).format(date)
  }`;

if (content.includes(oldFormatDate)) {
  content = content.replace(oldFormatDate, newFormatDate);
  console.log("Replaced formatDate");
} else {
  console.log("Could not find old formatDate");
}

// 2. Remove the time spans and splits
const oldInicio = `{/* 2. Início */}
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <Clock size={9} className="text-blue-500 shrink-0" />
                                <span className="text-[9px] font-black text-white tracking-tight">{formatDate(item.data_inicio).split(' ')[0]}</span>
                              </div>
                              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider pl-[18px]">
                                {formatDate(item.data_inicio).split(' ')[1]}
                              </span>
                            </div>`;

const newInicio = `{/* 2. Início */}
                            <div className="flex flex-col gap-0.5 justify-center">
                              <div className="flex items-center gap-1.5">
                                <Clock size={9} className="text-blue-500 shrink-0" />
                                <span className="text-[9px] font-black text-white tracking-tight">{formatDate(item.data_inicio)}</span>
                              </div>
                            </div>`;

if (content.includes(oldInicio)) {
  content = content.replace(oldInicio, newInicio);
  console.log("Replaced Inicio");
}

const oldFim = `{/* 3. Finalização */}
                            <div className="flex flex-col gap-0.5">
                              {item.data_fim ? (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle2 size={9} className="text-emerald-500 shrink-0" />
                                    <span className="text-[9px] font-black text-white tracking-tight">{formatDate(item.data_fim).split(' ')[0]}</span>
                                  </div>
                                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider pl-[18px]">
                                    {formatDate(item.data_fim).split(' ')[1]}
                                  </span>
                                </>
                              ) : (
                                <div className="flex items-center gap-1.5 opacity-30">
                                  <Clock size={9} className="shrink-0" />
                                  <span className="text-[8px] font-black text-slate-400 uppercase">Pendente</span>
                                </div>
                              )}
                            </div>`;

const newFim = `{/* 3. Finalização */}
                            <div className="flex flex-col gap-0.5 justify-center">
                              {item.data_fim ? (
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 size={9} className="text-emerald-500 shrink-0" />
                                  <span className="text-[9px] font-black text-white tracking-tight">{formatDate(item.data_fim)}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 opacity-30">
                                  <Clock size={9} className="shrink-0" />
                                  <span className="text-[8px] font-black text-slate-400 uppercase">Pendente</span>
                                </div>
                              )}
                            </div>`;

if (content.includes(oldFim)) {
  content = content.replace(oldFim, newFim);
  console.log("Replaced Fim");
}

fs.writeFileSync(path, content, 'utf8');
console.log("File saved");
