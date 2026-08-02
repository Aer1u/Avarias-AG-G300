
const fs = require('fs');
const targetFile = 'src/app/page.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

// The ultimate fix: search for the broad substrings and replace them
// We use regex that allows for ANY junk between the key letters
content = content.replace(/CAPACIDADE F.*?SICA/g, 'CAPACIDADE FÍSICA');
content = content.replace(/GEOGR.*?FICO/g, 'GEOGRÁFICO');
content = content.replace(/HIST.*?RICO/g, 'HISTÓRICO');
content = content.replace(/DI.*?RIO/g, 'DIÁRIO');
content = content.replace(/Composi.*?o de Frota/g, 'Composição de Frota');
content = content.replace(/MOVIMENTA.*?ES/g, 'MOVIMENTAÇÕES');
content = content.replace(/N.*?O INFORMADO/g, 'NÃO INFORMADO');
content = content.replace(/CH.*?O/g, 'CHÃO');
content = content.replace(/PER.*?ODO/g, 'PERÍODO');
content = content.replace(/Relat.*?rio/g, 'Relatório');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Final restoration complete.');
