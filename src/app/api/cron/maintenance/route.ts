import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Mantenimiento diario (Vercel Cron):
 * 1. Expira reservas temporales vencidas y libera sus cupos.
 * 2. Hace una consulta ligera para que Supabase Free no pause el proyecto.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const sb = getServiceSupabase();
  const { data, error } = await sb.rpc("run_maintenance");
  if (error) {
    console.error("[cron] mantenimiento falló:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const ping = await sb.from("settings").select("id").eq("id", 1).maybeSingle();
  return NextResponse.json({ ok: true, result: data, ping: !ping.error });
}
