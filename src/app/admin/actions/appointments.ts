"use server";

import { z } from "zod";
import { adminAction, check, invalidate } from "@/lib/admin/action";
import { isValidColombianMobile } from "@/lib/booking/phone";
import type { AppointmentWithServices } from "@/lib/types";

const id = z.uuid();
const ADMIN_PATHS = ["/admin", "/admin/citas", "/admin/calendario"];

export const updateAppointmentStatus = adminAction(
  z.object({
    id,
    action: z.enum(["confirm_deposit", "mark_deposit_paid", "complete", "no_show", "cancel", "release", "mark_refunded"]),
    giveCredit: z.boolean().optional(),
    reason: z.string().max(300).optional(),
  }),
  async (input, { supabase }) => {
    check(
      await supabase.rpc("admin_update_appointment_status", {
        p_id: input.id,
        p_action: input.action,
        p_give_credit: input.giveCredit ?? null,
        p_reason: input.reason ?? "",
      }),
    );
    invalidate([], ADMIN_PATHS);
    return null;
  },
);

export const applyCustomerCredit = adminAction(z.object({ id }), async ({ id: apptId }, { supabase }) => {
  check(await supabase.rpc("admin_use_customer_credit", { p_id: apptId }));
  invalidate([], ADMIN_PATHS);
  return null;
});

export const rescheduleAppointment = adminAction(
  z.object({ id, startAt: z.iso.datetime({ offset: true }) }),
  async (input, { supabase }) => {
    check(await supabase.rpc("admin_reschedule_appointment", { p_id: input.id, p_new_start: input.startAt }));
    invalidate([], ADMIN_PATHS);
    return null;
  },
);

export const deleteAppointment = adminAction(z.object({ id }), async ({ id: apptId }, { supabase }) => {
  check(await supabase.from("appointments").delete().eq("id", apptId));
  invalidate([], ADMIN_PATHS);
  return null;
});

export const updateAppointmentNotes = adminAction(
  z.object({ id, notes: z.string().max(500) }),
  async (input, { supabase }) => {
    check(await supabase.from("appointments").update({ notes: input.notes }).eq("id", input.id));
    invalidate([], ADMIN_PATHS);
    return null;
  },
);

export const createManualAppointment = adminAction(
  z.object({
    serviceIds: z.array(z.uuid()).min(1, "Elige al menos un servicio.").max(10),
    startAt: z.iso.datetime({ offset: true }),
    name: z.string().trim().min(2, "Escribe el nombre del cliente.").max(100),
    phone: z.string().refine(isValidColombianMobile, "WhatsApp inválido (10 dígitos)."),
    email: z.union([z.literal(""), z.email("Correo inválido.")]).optional(),
    notes: z.string().max(500).optional(),
    depositMode: z.enum(["paid", "skip", "pending"]),
  }),
  async (input, { supabase }) => {
    const data = check(
      await supabase.rpc("admin_create_appointment", {
        p_service_ids: input.serviceIds,
        p_start_at: input.startAt,
        p_name: input.name,
        p_phone: input.phone,
        p_email: input.email || null,
        p_notes: input.notes ?? "",
        p_deposit_mode: input.depositMode,
      }),
    ) as { id: string; code: string };
    invalidate([], ADMIN_PATHS);
    return data;
  },
);

export const adminSlots = adminAction(
  z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), serviceIds: z.array(z.uuid()).min(1), exclude: z.uuid().optional() }),
  async (input, { supabase }) => {
    const data = check(
      await supabase.rpc("admin_get_slots", {
        p_day: input.day,
        p_service_ids: input.serviceIds,
        p_exclude: input.exclude ?? null,
      }),
    ) as { slot_start: string }[];
    return data.map((d) => d.slot_start);
  },
);

export const getAppointmentDetail = adminAction(z.object({ id }), async ({ id: apptId }, { supabase }) => {
  return check(
    await supabase
      .from("appointments")
      .select("*, appointment_services(*), customers(credit_balance)")
      .eq("id", apptId)
      .maybeSingle(),
  ) as AppointmentWithServices | null;
});
