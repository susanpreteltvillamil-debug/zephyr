"use server";

import { getServiceSupabase } from "@/lib/supabase/service";
import { dbErrorMessage } from "@/lib/booking/errors";
import { dayKeySchema, tokenSchema } from "@/lib/validation/booking";
import { z } from "zod";
import type { ActionResult, ManagedBooking } from "@/lib/types";

const rangeSchema = z.object({ token: tokenSchema, from: dayKeySchema, to: dayKeySchema });

/** Días con cupo para reagendar (excluye la propia cita). */
export async function daysForTokenAction(input: z.input<typeof rangeSchema>): Promise<ActionResult<string[]>> {
  const parsed = rangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Solicitud inválida." };
  const { token, from, to } = parsed.data;
  const { data, error } = await getServiceSupabase().rpc("get_days_for_token", {
    p_token: token,
    p_from: from,
    p_to: to,
  });
  if (error) return { ok: false, error: dbErrorMessage(error), code: error.code };
  return { ok: true, data: ((data ?? []) as { day: string }[]).map((r) => r.day) };
}

const daySchema = z.object({ token: tokenSchema, day: dayKeySchema });

export async function slotsForTokenAction(input: z.input<typeof daySchema>): Promise<ActionResult<string[]>> {
  const parsed = daySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Solicitud inválida." };
  const { data, error } = await getServiceSupabase().rpc("get_slots_for_token", {
    p_token: parsed.data.token,
    p_day: parsed.data.day,
  });
  if (error) return { ok: false, error: dbErrorMessage(error), code: error.code };
  return { ok: true, data: ((data ?? []) as { slot_start: string }[]).map((r) => r.slot_start) };
}

const rescheduleSchema = z.object({ token: tokenSchema, startAt: z.iso.datetime({ offset: true }) });

export async function rescheduleAction(input: z.input<typeof rescheduleSchema>): Promise<ActionResult<ManagedBooking>> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Solicitud inválida." };
  const { data, error } = await getServiceSupabase().rpc("reschedule_booking_by_token", {
    p_token: parsed.data.token,
    p_new_start: parsed.data.startAt,
  });
  if (error) return { ok: false, error: dbErrorMessage(error), code: error.code };
  return { ok: true, data: data as ManagedBooking };
}

export async function cancelAction(input: { token: string }): Promise<ActionResult<ManagedBooking>> {
  const parsed = tokenSchema.safeParse(input.token);
  if (!parsed.success) return { ok: false, error: "Solicitud inválida." };
  const { data, error } = await getServiceSupabase().rpc("cancel_booking_by_token", { p_token: parsed.data });
  if (error) return { ok: false, error: dbErrorMessage(error), code: error.code };
  return { ok: true, data: data as ManagedBooking };
}
