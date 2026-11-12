import "server-only";
import { headers } from "next/headers";

/**
 * Verifica el token de Cloudflare Turnstile en el servidor.
 * Si TURNSTILE_SECRET_KEY no está configurada (desarrollo local), se omite
 * la verificación y se registra una advertencia.
 */
export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[turnstile] TURNSTILE_SECRET_KEY no está configurada: la verificación anti-bots está desactivada.");
    }
    return true;
  }
  if (!token) return false;

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch (error) {
    console.error("[turnstile] error verificando:", error);
    return false;
  }
}
