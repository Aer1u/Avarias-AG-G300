require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: d1, error: e1 } = await supa
    .from('mapeamento')
    .select('"Id Palete"')
    .like('"Id Palete"', 'P.%');
    
  console.log("With quotes:", { data: d1 ? d1.length : null, error: e1 });

  const { data: d2, error: e2 } = await supa
    .from('mapeamento')
    .select('Id Palete')
    .like('Id Palete', 'P.%');
    
  console.log("Without quotes:", { data: d2 ? d2.length : null, error: e2 });
}
test();
