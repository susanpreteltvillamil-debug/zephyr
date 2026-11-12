import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

let publicClient: SupabaseClient | undefined;

/** Cliente anónimo sin cookies, apto para funciones cacheadas. Respeta RLS. */
export function getPublicSupabase(): SupabaseClient {
  publicClient ??= createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return publicClient;
}
