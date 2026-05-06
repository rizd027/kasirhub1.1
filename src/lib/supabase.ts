import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client khusus untuk halaman publik (seperti /menu) agar tidak mengirim token kadaluarsa
// milik admin saat admin mengetes fitur katalog di browsernya sendiri.
export const anonSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { 
    persistSession: false, 
    autoRefreshToken: false, 
    detectSessionInUrl: false,
    storageKey: 'anon-dummy-key'
  }
})
