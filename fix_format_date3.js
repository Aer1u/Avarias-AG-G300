const fs = require('fs');
let c = fs.readFileSync('src/components/RetrabalhosTab.tsx', 'utf8');

const s = c.indexOf('const formatDate');
const e = c.indexOf('const totalRetrabalhado');

const fnText = `const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit'
    }).format(date)
  }

  `;

c = c.substring(0, s) + fnText + c.substring(e);
fs.writeFileSync('src/components/RetrabalhosTab.tsx', c, 'utf8');
console.log('Fixed');
