const fs = require('fs');
const path = 'c:/Users/Pichau/OneDrive/documentos/big/Avarias-AG-G300-main (14)/Avarias-AG-G300-main/src/app/page.tsx';

let content = fs.readFileSync(path, 'utf8');

// Use Regex to be indentation-agnostic
// 1. Group 1: Group system quantities
content = content.replace(
  /\/\/ 1\. Group A501 \(System\) quantities by SKU[\s\S]+?a501Data\.forEach\(item => \{[\s\S]+?\}\);/,
  `// 1. Group System (Registros) quantities from movements
    const systemBySku = new Map();
    movimentos.forEach(m => {
      const sku = String(m['Produto'] || m['Código'] || m['Codigo'] || "").trim().toUpperCase()
        .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
      if (!sku || sku === "-" || sku === "nan") return;
      const ent = Number(m['Entrada']) || 0;
      const sai = Number(m['Saída']) || Number(m['Saida']) || 0;
      systemBySku.set(sku, (systemBySku.get(sku) || 0) + (ent - sai));
    });`
);

// 2. Normalize SKU lookup in the allData loop
content = content.replace(
  /allData\.forEach\(item => \{[\s\S]+?const sku = String\(item\.produto \|\| ""\)\.trim\(\)\.toUpperCase\(\);/,
  `allData.forEach(item => {
      const sku = String(item.produto || "").trim().toUpperCase()
        .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");`
);

fs.writeFileSync(path, content);
console.log('Success: Loop logic updated with Regex.');
