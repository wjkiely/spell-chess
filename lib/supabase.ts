import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { GameRow } from "./types";

type DB = { public: { Tables: { games: { Row: GameRow } } } };

// Lazy singleton – only created on first use, so missing env vars during
// build/module-load don't crash the process.
let _publicClient: SupabaseClient<DB> | null = null;

export function getSupabaseClient(): SupabaseClient<DB> {
  if (!_publicClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
      );
    }
    _publicClient = createClient<DB>(url, key);
  }
  return _publicClient;
}

// Convenience re-export so existing `supabase.channel(...)` call sites still work
export const supabase = new Proxy({} as SupabaseClient<DB>, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Service-role client – use ONLY inside API routes / server actions
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase service credentials. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
