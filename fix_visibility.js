const fs = require('fs');
const filepath = 'src/components/RetrabalhosTab.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

// 1. Part Number Visibility
content = content.replace(
  /<span className="text-\[10px\] font-black text-blue-400 font-mono tracking-widest bg-blue-500\/5 px-2 rounded border border-blue-500\/10">\s*\{lote\.codigo\}\s*<\/span>/,
  `<span className="text-[11px] font-black text-blue-400 font-mono tracking-widest bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20 shadow-sm shadow-blue-500/5">
                          {lote.codigo}
                        </span>`
);

// 2. Footer Metadata Visibility (Date & Reservas)
content = content.replace(
  /<div className="flex items-center gap-1\.5 text-slate-500"><span className="text-\[8px\] font-bold uppercase tracking-widest">\{formatDate\(lote\.items\[0\]\?\.data_inicio\)\}<\/span><\/div>/,
  `<div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500"><span className="text-[10px] font-black uppercase tracking-widest">{formatDate(lote.items[0]?.data_inicio)}</span></div>`
);

content = content.replace(
  /<div className="flex items-center gap-1\.5 text-slate-500"><Hash size=\{10\} className="text-slate-600" \/><span className="text-\[8px\] font-bold uppercase tracking-widest">\{lote\.items\.length\} Reservas<\/span><\/div>/,
  `<div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500"><Hash size={12} className="text-blue-500/50" /><span className="text-[10px] font-black uppercase tracking-widest">{lote.items.length} Reservas</span></div>`
);

fs.writeFileSync(filepath, content, 'utf-8');
console.log("Updated Part Number and Footer Metadata visibility!");
