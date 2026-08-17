const supabaseUrl = 'https://bvgwlkdqmkuuhqiwzfti.supabase.co';
const supabaseAnonKey = 'sb_publishable_sSplcLDY1MoxxlEVTKHUpg_piJhjjAS';

async function run() {
  const res = await fetch(supabaseUrl + '/rest/v1/', {
    headers: {
      'apikey': supabaseAnonKey,
      'Accept': 'application/openapi+json'
    }
  });
  const data = await res.json();
  console.log('OpenAPI Version:', data.openapi || data.swagger);
  const paths = Object.keys(data.paths || {});
  console.log('Available paths:', paths.filter(p => p.includes('embalagens')));
  
  if (data.components?.schemas?.embalagens_pedidas) {
    console.log('embalagens_pedidas schema properties:', Object.keys(data.components.schemas.embalagens_pedidas.properties));
  } else if (data.definitions?.embalagens_pedidas) {
    console.log('embalagens_pedidas definitions properties:', Object.keys(data.definitions.embalagens_pedidas.properties));
  }
}
run();
