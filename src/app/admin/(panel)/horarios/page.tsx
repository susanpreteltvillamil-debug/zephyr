import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import type { BusinessHour, TimeOff } from "@/lib/types";
import { HoursManager } from "./hours-manager";

export const metadata = { title: "Horarios y bloqueos" };

/** Bloqueos que terminaron hace menos de un día siguen visibles. */
function visibleSince(): string {
  return new Date(Date.now() - 86_400_000).toISOString();
}

export default async function HorariosPage() {
  const { supabase } = await requireAdminPage();
  const [hours, off] = await Promise.all([
    supabase.from("business_hours").select("*").order("weekday").order("start_time"),
    supabase
      .from("time_off")
      .select("*")
      .gte("end_at", visibleSince())
      .order("start_at"),
  ]);
  return (
    <>
      <PageHeader
        title="Horarios y bloqueos"
        description="Define varios rangos por día (por ejemplo, con pausa de almuerzo) y bloquea festivos, vacaciones u horas sueltas."
      />
      <HoursManager hours={(hours.data ?? []) as BusinessHour[]} timeOff={(off.data ?? []) as TimeOff[]} />
    </>
  );
}
