import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import type { GalleryItem } from "@/lib/types";
import { GalleryManager } from "./gallery-manager";

export const metadata = { title: "Galería" };

export default async function GaleriaPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("gallery_items").select("*").order("sort_order");
  return (
    <>
      <PageHeader
        title="Galería"
        description="Sube varias fotos a la vez: se comprimen a WebP (máx. 1600 px) en tu celular o computador antes de subirlas."
      />
      <GalleryManager items={(data ?? []) as GalleryItem[]} />
    </>
  );
}
