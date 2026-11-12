import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import { DEFAULT_SETTINGS } from "@/lib/data/public";
import type { Settings } from "@/lib/types";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Datos del negocio y reglas de reserva. Los cambios aplican de inmediato a las nuevas reservas."
      />
      <SettingsForm settings={(data as Settings | null) ?? DEFAULT_SETTINGS} />
    </>
  );
}
