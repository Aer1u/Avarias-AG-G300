const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bvgwlkdqmkuuhqiwzfti.supabase.co';
const supabaseAnonKey = 'sb_publishable_sSplcLDY1MoxxlEVTKHUpg_piJhjjAS';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const cleanRow = {
    Data: '2026-04-12',
    Produto: 'TEST-FIX',
    Entrada: 10,
    Saída: 0,
    Origem: 'Ajuste',
    Observação: 'Teste de depuração',
    'Movimentação Sistema': false
  };

  console.log('Attempting to insert:', cleanRow);
  const { error } = await supabase.from('Registros').insert([cleanRow]);
  
  if (error) {
    console.log('FAILED!');
    console.log('Error Message:', error.message);
    console.log('Error Details:', error.details);
    console.log('Error Hint:', error.hint);
    console.log('Error Code:', error.code);
  } else {
    console.log('SUCCESS!');
  }
}

testInsert();
