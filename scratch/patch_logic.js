const fs = require('fs');
const path = 'c:/Users/Pichau/OneDrive/documentos/big/Avarias-AG-G300-main (14)/Avarias-AG-G300-main/src/app/page.tsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Correct the formula
const oldFormula = 'const totalAvailable = inChao + Math.max(0, systemTotal - (mappedDriveIn + inChao));';
const newFormula = 'const totalAvailable = Math.max(inChao, systemTotal - mappedDriveIn);';
content = content.replace(oldFormula, newFormula);

// 2. Change A501 to Registros
const oldLoop = `    // 1. Group A501 (System) quantities by SKU
    const systemBySku = new Map();
    a501Data.forEach(item => {
      const sku = String(item['Produto'] || "").trim().toUpperCase();
      if (!sku || sku === "-" || sku === "nan") return;
      systemBySku.set(sku, (systemBySku.get(sku) || 0) + (Number(item['Quantidade']) || 0));
    });`;

const newLoop = `    // 1. Group System (Registros) quantities by SKU from raw movements
    const systemBySku = new Map();
    movimentos.forEach(m => {
      const sku = String(m['Produto'] || m['Código'] || m['Codigo'] || "").trim().toUpperCase()
        .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
      if (!sku || sku === "-" || sku === "nan") return;
      const ent = Number(m['Entrada']) || 0;
      const sai = Number(m['Saída']) || Number(m['Saida']) || 0;
      systemBySku.set(sku, (systemBySku.get(sku) || 0) + (ent - sai));
    });`;

content = content.replace(oldLoop, newLoop);

// 3. SKUs in chao/mapped loop normalization
const oldSkusLoop = `    allData.forEach(item => {
      const sku = String(item.produto || "").trim().toUpperCase();`;
const newSkusLoop = `    allData.forEach(item => {
      const sku = String(item.produto || "").trim().toUpperCase()
        .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");`;

content = content.replace(oldSkusLoop, newSkusLoop);

fs.writeFileSync(path, content);
console.log('Success: Logic updated.');
