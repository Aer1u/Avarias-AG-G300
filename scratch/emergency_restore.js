const fs = require('fs');
const path = 'c:/Users/Pichau/OneDrive/documentos/big/Avarias-AG-G300-main (14)/Avarias-AG-G300-main/src/app/page.tsx';

let content = fs.readFileSync(path, 'utf8');

const target = `    divergences: divergences
    };
      if (fetchError) {`;

const replacement = `    divergences: divergences
    };
  };

  const fetchAllSupabaseData = async (tableName: string) => {
    let allData: any[] = [];
    let error: any = null;
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error: fetchError, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(from, from + step - 1);

      if (fetchError) {`;

// Standardize line endings to \n for the replacement
content = content.replace(/\r\n/g, '\n');
const startIdx = content.indexOf(target);

if (startIdx !== -1) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content.replace(/\n/g, '\r\n'));
    console.log('Success: fetchAllSupabaseData restored.');
} else {
    console.error('Target not found. Current snippet around line 449:');
    const lines = content.split('\n');
    console.error(lines.slice(445, 455).join('\n'));
}
