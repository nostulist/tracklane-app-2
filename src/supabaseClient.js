import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at build/dev time instead of silently breaking storage later.
  throw new Error(
    "Отсутствуют VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Проверь файл .env (см. .env.example)."
  );
}

// The "anon" key is safe to ship in frontend code — it identifies the
// project, not a user. Actual data access is enforced server-side by
// Postgres Row Level Security policies (see schema.sql), so this key
// alone can never read or write another user's data.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
