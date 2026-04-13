
const fs = require('fs');
const targetFile = 'src/app/page.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

// Specialized fix for the Mapeamento tab leftovers
content = content.replace(/ARMAZ.*?M/g, 'ARMAZÉM');
content = content.replace(/OCUPA.*?O/g, 'OCUPAÇÃO');
content = content.replace(/posi.*?es/g, 'posições');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Final typography polish complete.');
