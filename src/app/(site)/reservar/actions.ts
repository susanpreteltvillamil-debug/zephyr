"use server";

import { getServiceSupabase } from "@/lib/supabase/service";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { createBookingSchema, type CreateBookingInput } from "@/lib/validation/booking";
import { dbErrorMessage } from "@/lib/booking/errors";
import type { ActionResult, BookingResult } from "@/lib/types";

export async function createBookingAction(input: CreateBookingInput): Promise<ActionResult<BookingResult>> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario." };
  }
  const data = parsed.data;

  // Honeypot: un bot llenó el campo oculto. Respondemos de forma genérica.
  if (data.website) {
    return { ok: false, error: "No pudimos procesar tu reserva. Intenta de nuevo." };
  }

  const human = await verifyTurnstile(data.turnstileToken);
  if (!human) {
    return { ok: false, error: "No pudimos verificar que eres una persona. Recarga la página e intenta de nuevo." };
  }

  const { data: result, error } = await getServiceSupabase().rpc("create_booking", {
    p_service_ids: data.serviceIds,
    p_start_at: data.startAt,
    p_name: data.name,
    p_phone: data.phone,
    p_email: data.email ?? null,
    p_notes: data.notes ?? "",
  });

  if (error) {
    return { ok: false, error: dbErrorMessage(error), code: error.code };
  }
  return { ok: true, data: result as BookingResult };
}
