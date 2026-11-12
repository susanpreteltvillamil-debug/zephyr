import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import type { Service, ServiceCategory } from "@/lib/types";
import { ManualAppointmentForm } from "./manual-form";

export const metadata = { title: "Nueva cita" };

export default async function NuevaCitaPage() {
  const { supabase } = await requireAdminPage();
  const [cats, svcs, settings] = await Promise.all([
    supabase.from("service_categories").select("*").order("sort_order"),
    supabase.from("services").select("*").eq("active", true).order("sort_order"),
    supabase.from("settings").select("deposit_percent").eq("id", 1).maybeSingle(),
  ]);
  const services = (svcs.data ?? []) as Service[];
  const categories = ((cats.data ?? []) as ServiceCategory[])
    .map((c) => ({ ...c, services: services.filter((s) => s.category_id === c.id) }))
    .filter((c) => c.services.length > 0);

  return (
    <>
      <PageHeader
        title="Nueva cita manual"
        description="Para reservas por teléfono, WhatsApp o en el salón. Los choques con otras citas siguen bloqueados."
      />
      <ManualAppointmentForm
        categories={categories}
        depositPercent={(settings.data as { deposit_percent: number } | null)?.deposit_percent ?? 20}
      />
    </>
  );
}
