import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bvgwlkdqmkuuhqiwzfti.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sSplcLDY1MoxxlEVTKHUpg_piJhjjAS'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
