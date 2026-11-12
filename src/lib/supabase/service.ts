import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

let serviceClient: SupabaseClient | undefined;

/**
 * Cliente con la clave service_role. SOLO servidor: nunca importar desde
 * componentes de cliente. Se usa para la reserva web (después de validar
 * Turnstile), la gestión por token y el cron.
 */
export function getServiceSupabase(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.supabaseUrl || !key) {
    throw new Error("Falta configurar NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  serviceClient ??= createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}
