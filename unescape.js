const fs = require('fs');
['fix_card.js', 'fix_table.js'].forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (c.startsWith('"')) {
    try {
      c = JSON.parse(c);
      fs.writeFileSync(f, c);
      console.log(`Unescaped ${f}`);
    } catch (e) {
      console.log(`Error parsing ${f}:`, e);
    }
  }
});
