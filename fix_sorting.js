const fs = require('fs');
const filepath = 'src/components/RetrabalhosTab.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

// 1. Update FILA sorting
content = content.replace(
  /\.sort\(\(a, b\) => b\.lote - a\.lote\)\s+\}/,
  `.sort((a, b) => {
        const dateA = a.items[0]?.data_inicio ? new Date(a.items[0].data_inicio).getTime() : 0;
        const dateB = b.items[0]?.data_inicio ? new Date(b.items[0].data_inicio).getTime() : 0;
        return dateB - dateA;
      })
    }`
);

// 2. Update Grouped Lote sorting
content = content.replace(
  /\.sort\(\(a, b\) => b\.lote - a\.lote\)\s+\}, \[records,/,
  `.sort((a, b) => {
      const dateA = Math.max(...a.items.map(i => i.data_inicio ? new Date(i.data_inicio).getTime() : 0));
      const dateB = Math.max(...b.items.map(i => i.data_inicio ? new Date(i.data_inicio).getTime() : 0));
      return dateB - dateA;
    })
  }, [records,`
);

fs.writeFileSync(filepath, content, 'utf-8');
console.log("Updated sorting to be by date (newest first)!");
