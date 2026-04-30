const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bvgwlkdqmkuuhqiwzfti.supabase.co';
const supabaseAnonKey = 'sb_publishable_sSplcLDY1MoxxlEVTKHUpg_piJhjjAS';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('Registros').select('*').limit(1);
  if (error) {
    console.error('Error fetching Registros:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in Registros table:', Object.keys(data[0]));
  } else {
    // If no data, try to insert a dummy row or something to see error
    console.log('No data found in Registros. Checking table info via RPC or other means is complex without admin keys, but let\'s try a dry-run insert.');
    const { error: insError } = await supabase.from('Registros').insert([{ Data: '2026-01-01', Produto: 'TEST' }]);
    if (insError) {
       console.error('Insert error (might show missing columns):', insError.message, insError.details, insError.hint);
    }
  }
}

check();
