import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import type { z } from "zod";
import { AdminAuthError, requireAdmin, type AdminSession } from "./auth";
import { dbErrorMessage, type DbErrorLike } from "@/lib/booking/errors";
import type { CacheTag } from "@/lib/data/public";
import type { ActionResult } from "@/lib/types";

export class DbError extends Error {
  constructor(public readonly db: DbErrorLike) {
    super(dbErrorMessage(db));
  }
}

/** Lanza si la respuesta de Supabase trae error. */
export function check<T>(res: { data: T; error: DbErrorLike | null }): T {
  if (res.error) throw new DbError(res.error);
  return res.data;
}

/**
 * Envuelve una server action del dashboard: valida con zod, exige sesión de
 * administradora y traduce errores a mensajes legibles.
 */
export function adminAction<S extends z.ZodType, R>(
  schema: S,
  handler: (input: z.output<S>, session: AdminSession) => Promise<R>,
) {
  return async (input: z.input<S>): Promise<ActionResult<R>> => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
      return { ok: false, error: `${issue?.message ?? "Datos inválidos"}${where}` };
    }
    try {
      const session = await requireAdmin();
      const data = await handler(parsed.data, session);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof AdminAuthError) return { ok: false, error: error.message, code: "AUTH" };
      if (error instanceof DbError) return { ok: false, error: error.message, code: error.db.code };
      console.error("[admin action]", error);
      return { ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." };
    }
  };
}

/** Invalida la caché de la landing de inmediato y refresca el dashboard. */
export function invalidate(tags: CacheTag[], paths: string[] = []) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  for (const p of paths) revalidatePath(p);
}
