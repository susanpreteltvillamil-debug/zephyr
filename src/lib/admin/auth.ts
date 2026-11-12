import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export interface AdminSession {
  supabase: SupabaseClient;
  userId: string;
  email: string;
}

/** Devuelve la sesión si la usuaria es administradora; si no, null. */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: admin } = await supabase.from("admins").select("user_id, email").eq("user_id", claims.sub).maybeSingle();
  if (!admin) return null;
  return { supabase, userId: claims.sub, email: (admin as { email: string }).email };
});

/** Para páginas del dashboard: redirige al login si no hay sesión de admin. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Para server actions: lanza si no hay sesión de admin. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new AdminAuthError();
  return session;
}

export class AdminAuthError extends Error {
  constructor() {
    super("Tu sesión expiró. Vuelve a iniciar sesión.");
  }
}
