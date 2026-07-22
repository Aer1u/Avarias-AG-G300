
const fs = require('fs');
const targetFile = 'src/app/page.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

// The Ultimate Fix - Mapping double-encoded sequences to correct characters
const replacements = [
  { from: /Ã§/g, to: 'ç' },
  { from: /Ã£/g, to: 'ã' },
  { from: /Ã³/g, to: 'ó' },
  { from: /Ã¡/g, to: 'á' },
  { from: /Ã­/g, to: 'í' },
  { from: /Ãº/g, to: 'ú' },
  { from: /Ãª/g, to: 'ê' },
  { from: /Ã\s/g, to: 'Í' }, // Special case for FÃ SICA which often has a space
  { from: /Ã“/g, to: 'Ó' },
  { from: /Ã€/g, to: 'À' },
  { from: /Ã•/g, to: 'Õ' },
  { from: /Ã‡/g, to: 'Ç' },
  { from: /Ã‚/g, to: 'Â' },
  { from: /Ã\u0081/g, to: 'Á' },
  { from: /Ã‰/g, to: 'É' },
  { from: /Ãš/g, to: 'Ú' },
  { from: /Ã\u00a0/g, to: 'à' },
  { from: /Ãµ/g, to: 'õ' },
  { from: /Ã\u008d/g, to: 'Í' },
  { from: /Ã\u0093/g, to: 'Ó' },
];

let newContent = content;
replacements.forEach(r => {
  newContent = newContent.split(r.from).join(r.to);
});

// Fix specific known broken strings with junk in between
newContent = newContent.replace(/CAPACIDADE F.*?SICA/g, 'CAPACIDADE FÍSICA');
newContent = newContent.replace(/GEOGR.*?FICO/g, 'GEOGRÁFICO');
newContent = newContent.replace(/HIST.*?RICO/g, 'HISTÓRICO');
newContent = newContent.replace(/DI.*?RIO/g, 'DIÁRIO');
newContent = newContent.replace(/MOVIMENTA.*?ES/g, 'MOVIMENTAÇÕES');
newContent = newContent.replace(/N.*?O INFORMADO/g, 'NÃO INFORMADO');
newContent = newContent.replace(/CH.*?O/g, 'CHÃO');
newContent = newContent.replace(/PER.*?ODO/g, 'PERÍODO');
newContent = newContent.replace(/D.*?VIDA/g, 'DÚVIDA');
newContent = newContent.replace(/Relat.*?rio/g, 'Relatório');

fs.writeFileSync(targetFile, newContent, 'utf8');
console.log('Global encoding restoration (V3) complete.');
