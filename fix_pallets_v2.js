const fs = require('fs');
const filepath = 'src/components/RetrabalhosTab.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

// Update Enviado Pallets Visibility
content = content.replace(
  /<span className="text-\[9px\] font-bold text-slate-400 dark:text-slate-500 mt-1 whitespace-nowrap">\{formatPallets\(lote\.totalEnviado, lote\.grade, true\)\}<\/span>/,
  `<span className="text-[10px] font-black text-slate-500 dark:text-slate-400 mt-1.5 whitespace-nowrap opacity-80">{formatPallets(lote.totalEnviado, lote.grade, true)}</span>`
);

// Update Retornado Pallets Visibility
content = content.replace(
  /<span className="text-\[9px\] font-bold text-emerald-500\/70 mt-1 whitespace-nowrap">\{formatPallets\(lote\.totalRetornado, lote\.grade, true\)\}<\/span>/,
  `<span className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 mt-1.5 whitespace-nowrap opacity-80">{formatPallets(lote.totalRetornado, lote.grade, true)}</span>`
);

fs.writeFileSync(filepath, content, 'utf-8');
console.log("Updated Pallet visibility to be even more prominent!");
