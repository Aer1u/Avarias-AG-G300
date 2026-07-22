const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bvgwlkdqmkuuhqiwzfti.supabase.co';
const supabaseAnonKey = 'sb_publishable_sSplcLDY1MoxxlEVTKHUpg_piJhjjAS';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumnDetails() {
  // Querying information_schema requires service role usually, but maybe we can check by sampling
  // Actually, let's just try to insert a row with minimal fields and see what happens.
  
  const cleanRow = {
    Data: '2026-04-12',
    Produto: 'TEST-NULL-CHECK',
    Entrada: 1,
    'Saída': 0,
    Origem: 'Ajuste',
    'Observação': 'Checking nulls',
    'Movimentação Sistema': false
  };

  console.log('Inserting row with basic fields...');
  const { error } = await supabase.from('Registros').insert([cleanRow]);
  
  if (error) {
    console.log('INSERT FAILED!');
    console.log('Msg:', error.message);
    console.log('Details:', error.details);
  } else {
    console.log('INSERT SUCCESS!');
  }
}

checkColumnDetails();
