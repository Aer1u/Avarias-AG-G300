const fs = require('fs');
const filepath = 'src/components/RetrabalhosTab.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

// Update Enviado Pallets Visibility in sub-table
content = content.replace(
  /<span className="text-\[9px\] font-bold text-slate-500 mt-1 whitespace-nowrap">\{formatPallets\(item\.quantidade_enviada, lote\.grade, true\)\}<\/span>/,
  `<span className="text-[10px] font-black text-slate-400 mt-1.5 whitespace-nowrap">{formatPallets(item.quantidade_enviada, lote.grade, true)}</span>`
);

// Update Retornado Pallets Visibility in sub-table
content = content.replace(
  /<span className="text-\[9px\] font-bold text-emerald-500\/60 mt-1 whitespace-nowrap">\{formatPallets\(item\.quantidade_retornada, lote\.grade, true\)\}<\/span>/,
  `<span className="text-[10px] font-black text-emerald-500/80 mt-1.5 whitespace-nowrap">{formatPallets(item.quantidade_retornada, lote.grade, true)}</span>`
);

fs.writeFileSync(filepath, content, 'utf-8');
console.log("Further enhanced sub-table pallet visibility!");
