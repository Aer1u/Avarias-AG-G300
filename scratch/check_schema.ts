import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bvgwlkdqmkuuhqiwzfti.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' // Assuming it's in env

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  const { data, error } = await supabase.from('mapeamento').select('*').limit(1)
  if (error) {
    console.error('Error fetching schema:', error)
  } else {
    console.log('Row structure:', JSON.stringify(data[0], null, 2))
  }
}

checkSchema()
