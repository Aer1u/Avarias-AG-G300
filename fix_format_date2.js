const fs = require('fs');
let c = fs.readFileSync('src/components/RetrabalhosTab.tsx', 'utf8');
const badStr = `}).format(date)
  }).format(date).replace(',', '')
  }`;
const goodStr = `}).format(date)
  }`;
c = c.replace(badStr, goodStr);
fs.writeFileSync('src/components/RetrabalhosTab.tsx', c, 'utf8');
console.log('Cleaned');
