const fs = require('fs');
const filepath = 'src/components/RetrabalhosTab.tsx';
let c = fs.readFileSync(filepath, 'utf8');

const regex = /const formatDate = \(dateStr: string\) => \{[\s\S]*?\}(?:\.format\(date\)(?:\.replace\([^)]*\))?)?/g;
const newFn = `const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit'
    }).format(date)
  }`;

c = c.replace(regex, newFn);
fs.writeFileSync(filepath, c, 'utf8');
console.log('Replaced function');
