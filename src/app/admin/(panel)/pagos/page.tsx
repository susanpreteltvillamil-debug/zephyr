import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import type { PaymentMethod } from "@/lib/types";
import { PaymentsManager } from "./payments-manager";

export const metadata = { title: "Medios de pago" };

export default async function PagosPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("payment_methods").select("*").order("sort_order");
  return (
    <>
      <PageHeader
        title="Medios de pago"
        description="Se muestran en la confirmación de la reserva con botón para copiar el número y el titular."
      />
      <PaymentsManager methods={(data ?? []) as PaymentMethod[]} />
    </>
  );
}
