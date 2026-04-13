import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bvgwlkdqmkuuhqiwzfti.supabase.co',
  'sb_publishable_sSplcLDY1MoxxlEVTKHUpg_piJhjjAS'
);

// Get ALL rows (no filter)
console.log('=== All rows (first 5) ===');
const { data, error } = await supabase
  .from('mapeamento')
  .select('id, Posição, Código, Quantidade')
  .limit(5);

if (error) { console.error('FETCH ERROR:', error); process.exit(1); }
console.log('Total fetched:', data?.length);
console.log(data);

// Test delete on id=1 (exists, saw in first test)
console.log('\n=== Testing DELETE id=1 ===');
const { error: delErr, count } = await supabase
  .from('mapeamento')
  .delete({ count: 'exact' })
  .eq('id', 999999); // fake id - safe

console.log('DELETE result - error:', delErr, 'count:', count);

// Test INSERT
console.log('\n=== Testing INSERT ===');
const { data: insData, error: insErr } = await supabase
  .from('mapeamento')
  .insert([{
    'Posição': 'Chão',
    'Nível': 0,
    'Profundidade': 1,
    'Código': data?.[0]?.['Código'] || '5016-01',
    'Quantidade': 1,
    'Parte Tombada': 0,
    'Parte Molhada': 0,
  }])
  .select();

if (insErr) {
  console.error('INSERT FAILED:', insErr.code, insErr.message);
} else {
  console.log('INSERT OK! id=', insData?.[0]?.id);
  // Cleanup
  await supabase.from('mapeamento').delete().eq('id', insData[0].id);
  console.log('Cleanup done');
}
