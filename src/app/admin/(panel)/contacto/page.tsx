import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import type { ContactChannel } from "@/lib/types";
import { ChannelsManager } from "./channels-manager";

export const metadata = { title: "Contacto y redes" };

export default async function ContactoPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("contact_channels").select("*").order("sort_order");
  return (
    <>
      <PageHeader
        title="Contacto y redes"
        description="Agrega, edita, desactiva o reordena tus canales. El primer WhatsApp activo es el que reciben los comprobantes."
      />
      <ChannelsManager channels={(data ?? []) as ContactChannel[]} />
    </>
  );
}
