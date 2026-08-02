
const fs = require('fs');
const content = fs.readFileSync('src/app/page.tsx', 'utf8');

const nonAscii = [];
for (let i = 0; i < content.length; i++) {
  if (content.charCodeAt(i) > 127) {
    nonAscii.push({ char: content[i], code: content.charCodeAt(i), index: i });
  }
}

console.log('Total Non-ASCII characters:', nonAscii.length);
console.log('Sample:', nonAscii.slice(0, 50));
