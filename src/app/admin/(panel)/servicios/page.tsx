import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import type { Service, ServiceCategory } from "@/lib/types";
import { ServicesManager } from "./services-manager";

export const metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const { supabase } = await requireAdminPage();
  const [cats, svcs] = await Promise.all([
    supabase.from("service_categories").select("*").order("sort_order"),
    supabase.from("services").select("*").order("sort_order"),
  ]);
  return (
    <>
      <PageHeader
        title="Servicios y categorías"
        description="Edita precios, duraciones e imágenes. Arrastra para cambiar el orden. Los cambios se ven de inmediato en la web."
      />
      <ServicesManager categories={(cats.data ?? []) as ServiceCategory[]} services={(svcs.data ?? []) as Service[]} />
    </>
  );
}
