const fs = require('fs');
const filepath = 'src/components/RetrabalhosTab.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

// 1. Update Enviado Column in sub-table
content = content.replace(
  /\{\/\* 7\. Enviado \*\/\}[\s\S]*?<div className="flex items-center justify-end">[\s\S]*?\{item\.quantidade_enviada \? \([\s\S]*?<span className="text-\[12px\] font-medium text-slate-200 font-mono">\{item\.quantidade_enviada\}<\/span>[\s\S]*?\) : \([\s\S]*?<span className="text-\[12px\] font-medium text-blue-500 font-mono">—<\/span>[\s\S]*?\)[\s\S]*?\}[\s\S]*?<\/div>/,
  `{/* 7. Enviado */}
                                <div className="flex flex-col items-end justify-center">
                                  {item.quantidade_enviada ? (
                                    <>
                                      <span className="text-[12px] font-medium text-slate-200 font-mono leading-none">{item.quantidade_enviada}</span>
                                      <span className="text-[9px] font-bold text-slate-500 mt-1 whitespace-nowrap">{formatPallets(item.quantidade_enviada, lote.grade, true)}</span>
                                    </>
                                  ) : (
                                    <span className="text-[12px] font-medium text-blue-500 font-mono">—</span>
                                  )}
                                </div>`
);

// 2. Update Retornado Column in sub-table
content = content.replace(
  /\{\/\* 9\. Retornado \*\/\}[\s\S]*?<div className="flex items-center">[\s\S]*?\{item\.quantidade_retornada \? \([\s\S]*?<span className="text-\[12px\] font-medium text-emerald-400 font-mono">\{item\.quantidade_retornada\}<\/span>[\s\S]*?\) : \([\s\S]*?<span className="text-\[12px\] font-medium text-blue-500 font-mono">—<\/span>[\s\S]*?\)[\s\S]*?\}[\s\S]*?<\/div>/,
  `{/* 9. Retornado */}
                                <div className="flex flex-col items-start justify-center">
                                  {item.quantidade_retornada ? (
                                    <>
                                      <span className="text-[12px] font-medium text-emerald-400 font-mono leading-none">{item.quantidade_retornada}</span>
                                      <span className="text-[9px] font-bold text-emerald-500/60 mt-1 whitespace-nowrap">{formatPallets(item.quantidade_retornada, lote.grade, true)}</span>
                                    </>
                                  ) : (
                                    <span className="text-[12px] font-medium text-blue-500 font-mono">—</span>
                                  )}
                                </div>`
);

fs.writeFileSync(filepath, content, 'utf-8');
console.log("Updated sub-table rows to include pallet counts for Enviado and Retornado!");
