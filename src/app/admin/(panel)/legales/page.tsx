import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import type { LegalDocument } from "@/lib/types";
import { LegalEditor } from "./legal-editor";

export const metadata = { title: "Políticas legales" };

export default async function LegalesPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("legal_documents").select("*").order("slug");
  return (
    <>
      <PageHeader
        title="Políticas legales"
        description="Edita en Markdown. Sube la versión cuando hagas cambios importantes: cada reserva guarda la versión que aceptó el cliente."
      />
      <LegalEditor docs={(data ?? []) as LegalDocument[]} />
    </>
  );
}
