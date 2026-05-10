import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.warn('Supabase server client not fully configured: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing')
}

export const supabaseAdmin = createClient(url ?? '', key ?? '', {
  auth: { persistSession: false },
})

export default supabaseAdmin
