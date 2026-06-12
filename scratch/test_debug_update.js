const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bvgwlkdqmkuuhqiwzfti.supabase.co';
const supabaseAnonKey = 'sb_publishable_sSplcLDY1MoxxlEVTKHUpg_piJhjjAS';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpdate() {
  // First get a real ID
  const { data } = await supabase.from('Registros').select('id').limit(1);
  if (!data || data.length === 0) {
    console.log('No records to test update.');
    return;
  }
  const id = data[0].id;
  
  // Try to update with all columns to simulate the UI behavior
  const cleanRow = {
    Data: '2026-04-12',
    Produto: 'TEST-UPDATE',
    Entrada: 5,
    'Saída': 0,
    'Movimentação Sistema': true,
    'Observação': 'Update test'
    // I should probably also try to include created_at if it's there
  };

  console.log(`Attempting to update ID ${id}:`, cleanRow);
  const { error } = await supabase.from('Registros').update(cleanRow).eq('id', id);
  
  if (error) {
    console.log('FAILED!');
    console.log('Error Message:', error.message);
    console.log('Error Details:', error.details);
    console.log('Error Code:', error.code);
  } else {
    console.log('SUCCESS!');
  }
}

testUpdate();
