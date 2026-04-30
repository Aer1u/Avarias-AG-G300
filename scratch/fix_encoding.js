
const fs = require('fs');
const path = require('path');

const targetFile = 'src/app/page.tsx';
const content = fs.readFileSync(targetFile, 'utf8');

// Regex to catch common double-encoded patterns or just the known broken ones
const replacements = [
  { from: /CAPACIDADE F[\s\S]{1,3} SICA/g, to: 'CAPACIDADE FÍSICA' },
  { from: /GEOGR[\s\S]{1,3} FICO/g, to: 'GEOGRÁFICO' },
  { from: /HIST[\s\S]{1,3} RICO/g, to: 'HISTÓRICO' },
  { from: /DI[\s\S]{1,3} RIO/g, to: 'DIÁRIO' },
  { from: /Composi[\s\S]{1,4} o/g, to: 'Composição' },
  { from: /MOVIMENTA[\s\S]{1,6} ES/g, to: 'MOVIMENTAÇÕES' },
  { from: /N[\s\S]{1,2} O INFORMADO/g, to: 'NÃO INFORMADO' },
  { from: /CH[\s\S]{1,2} O/g, to: 'CHÃO' },
];

let newContent = content;
replacements.forEach(r => {
  newContent = newContent.replace(r.from, r.to);
});

fs.writeFileSync(targetFile, newContent, 'utf8');
console.log('Restoration complete.');
