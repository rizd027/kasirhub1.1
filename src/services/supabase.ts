import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        realtime: {
            params: {
                eventsPerSecond: 2
            }
        }
    }
)

export const anonSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: { 
            persistSession: false, 
            autoRefreshToken: false, 
            detectSessionInUrl: false,
            storageKey: 'anon-dummy-key'
        }
    }
)
