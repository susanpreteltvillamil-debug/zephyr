"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

let browserClient: SupabaseClient | undefined;

/** Cliente para el navegador (clave pública/anon). Respeta RLS. */
export function getBrowserSupabase(): SupabaseClient {
  browserClient ??= createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return browserClient;
}
