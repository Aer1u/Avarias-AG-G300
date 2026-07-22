const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://bvgwlkdqmkuuhqiwzfti.supabase.co';
const supabaseAnonKey = 'sb_publishable_sSplcLDY1MoxxlEVTKHUpg_piJhjjAS';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- Testing join ---');
  const { data: joinData, error: joinErr } = await supabase
    .from('documento_palete')
    .select(`
      id, remessa,
      relacao_documento (
        codigo, quantidade
      )
    `)
    .limit(5);
  console.log('Join Result:', joinData, joinErr);
}

check();
