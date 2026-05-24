import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Guard: if env vars are missing (local dev without .env), create a dummy client
// that fails gracefully instead of crashing the whole app at module load time.
export const supabase = (url && key)
  ? createClient(url, key)
  : createClient('https://placeholder.supabase.co', 'placeholder-key-for-local-dev')
