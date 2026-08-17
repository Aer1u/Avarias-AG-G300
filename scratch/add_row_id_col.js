// Script para adicionar coluna row_id na tabela pedidos_ba
// Execute: node scratch/add_row_id_col.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bvgwlkdqmkuuhqiwzfti.supabase.co';
const supabaseKey = 'sb_publishable_sSplcLDY1MoxxlEVTKHUpg_piJhjjAS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Testa se a coluna já existe fazendo uma query simples
  const { data, error } = await supabase.from('pedidos_ba').select('row_id').limit(1);
  
  if (error) {
    if (error.message && error.message.includes('row_id')) {
      console.log('Coluna row_id NÃO existe ainda. Precisa ser criada via SQL Editor no Supabase.');
      console.log('\nSQL para executar no Supabase SQL Editor:');
      console.log('ALTER TABLE pedidos_ba ADD COLUMN IF NOT EXISTS row_id TEXT;');
    } else {
      console.error('Erro ao verificar coluna:', error);
    }
  } else {
    console.log('✅ Coluna row_id já existe na tabela pedidos_ba!');
    console.log('Dados:', data);
  }
}

main();
