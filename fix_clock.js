const fs = require('fs');
const path = 'src/components/RetrabalhosTab.tsx';
let c = fs.readFileSync(path, 'utf8');
c = c.replace('<Clock size={10} className="text-slate-600" />', '');
fs.writeFileSync(path, c);
console.log('Removed clock icon');
