
const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

async function checkMapeamento() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  console.log('Fetching sample from mapeamento...');
  const { data, error } = await supabase.from('mapeamento').select('*').limit(5);
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Sample Data Key Names:', Object.keys(data[0] || {}));
  console.log('Sample Row:', data[0]);
}

checkMapeamento();
