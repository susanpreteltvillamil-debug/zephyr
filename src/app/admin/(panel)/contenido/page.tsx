import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import { parseSection, SECTION_KEYS, type AllSections, type SectionKey } from "@/lib/content/sections";
import type { SiteSectionRow } from "@/lib/types";
import { ContentManager } from "./content-manager";

export const metadata = { title: "Contenido del sitio" };

export default async function ContenidoPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("site_sections").select("*").order("sort_order");
  const rows = (data ?? []) as SiteSectionRow[];
  const content = {} as Record<SectionKey, unknown>;
  for (const key of SECTION_KEYS) {
    content[key] = parseSection(key, rows.find((r) => r.key === key)?.content);
  }
  const order = [
    ...rows.filter((r) => (SECTION_KEYS as string[]).includes(r.key)).map((r) => ({ key: r.key as SectionKey, visible: r.visible })),
    ...SECTION_KEYS.filter((k) => !rows.some((r) => r.key === k)).map((key) => ({ key, visible: true })),
  ];

  return (
    <>
      <PageHeader
        title="Contenido del sitio"
        description="Edita textos e imágenes de cada sección, muéstralas u ocúltalas y arrástralas para cambiar el orden."
      />
      <ContentManager content={content as AllSections} order={order} />
    </>
  );
}
