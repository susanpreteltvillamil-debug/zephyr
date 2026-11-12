import "server-only";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { getPublicSupabase } from "@/lib/supabase/public";
import { defaultSections, parseSection, SECTION_KEYS, type AllSections, type SectionKey } from "@/lib/content/sections";
import type {
  BusinessHour,
  ContactChannel,
  GalleryItem,
  LegalDocument,
  PaymentMethod,
  Service,
  ServiceCategory,
  Settings,
  SiteSectionRow,
} from "@/lib/types";

/** Etiquetas de caché: el dashboard las invalida al guardar. */
export const TAGS = {
  settings: "settings",
  services: "services",
  sections: "sections",
  gallery: "gallery",
  contact: "contact",
  payments: "payments",
  legal: "legal",
  hours: "hours",
} as const;

export type CacheTag = (typeof TAGS)[keyof typeof TAGS];

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  salon_name: "Zephyr",
  tagline: "Uñas impecables, cuidado de verdad",
  address: "",
  city: "",
  whatsapp_number: "3144657351",
  deposit_percent: 20,
  hold_minutes: 120,
  min_notice_minutes: 120,
  max_advance_days: 60,
  slot_interval_minutes: 30,
  buffer_minutes: 0,
  change_cutoff_hours: 24,
  max_reschedules: 1,
  cancellation_refund_mode: "credit",
  max_pending_per_phone: 2,
  updated_at: new Date(0).toISOString(),
};

async function safe<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;
  try {
    return await fn();
  } catch (error) {
    console.error(`[data] ${label}:`, error);
    return fallback;
  }
}

export const getSettings = unstable_cache(
  () =>
    safe("settings", DEFAULT_SETTINGS, async () => {
      const { data, error } = await getPublicSupabase().from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return (data as Settings | null) ?? DEFAULT_SETTINGS;
    }),
  ["settings"],
  { tags: [TAGS.settings], revalidate: 3600 },
);

export interface Catalog {
  categories: (ServiceCategory & { services: Service[] })[];
  services: Service[];
}

export const getCatalog = unstable_cache(
  () =>
    safe<Catalog>("catalog", { categories: [], services: [] }, async () => {
      const sb = getPublicSupabase();
      const [cats, svcs] = await Promise.all([
        sb.from("service_categories").select("*").order("sort_order"),
        sb.from("services").select("*").order("sort_order"),
      ]);
      if (cats.error) throw cats.error;
      if (svcs.error) throw svcs.error;
      const services = (svcs.data ?? []) as Service[];
      const categories = ((cats.data ?? []) as ServiceCategory[])
        .map((c) => ({ ...c, services: services.filter((s) => s.category_id === c.id) }))
        .filter((c) => c.services.length > 0);
      return { categories, services };
    }),
  ["catalog"],
  { tags: [TAGS.services], revalidate: 3600 },
);

export interface SectionsData {
  content: AllSections;
  /** Orden y visibilidad de las secciones. */
  order: { key: SectionKey; visible: boolean }[];
}

export const getSections = unstable_cache(
  () =>
    safe<SectionsData>(
      "sections",
      { content: defaultSections, order: SECTION_KEYS.map((key) => ({ key, visible: true })) },
      async () => {
        const { data, error } = await getPublicSupabase().from("site_sections").select("*").order("sort_order");
        if (error) throw error;
        const rows = (data ?? []) as SiteSectionRow[];
        const content = { ...defaultSections } as Record<SectionKey, unknown>;
        for (const row of rows) {
          if ((SECTION_KEYS as string[]).includes(row.key)) {
            const key = row.key as SectionKey;
            content[key] = parseSection(key, row.content);
          }
        }
        // RLS solo devuelve secciones visibles: las que no llegan, están ocultas.
        const visibleKeys = new Set(rows.map((r) => r.key));
        const order = [
          ...rows.filter((r) => (SECTION_KEYS as string[]).includes(r.key)).map((r) => ({ key: r.key as SectionKey, visible: true })),
          ...SECTION_KEYS.filter((k) => !visibleKeys.has(k)).map((key) => ({ key, visible: false })),
        ];
        return { content: content as AllSections, order };
      },
    ),
  ["sections"],
  { tags: [TAGS.sections], revalidate: 3600 },
);

export const getGallery = unstable_cache(
  () =>
    safe<GalleryItem[]>("gallery", [], async () => {
      const { data, error } = await getPublicSupabase().from("gallery_items").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as GalleryItem[];
    }),
  ["gallery"],
  { tags: [TAGS.gallery], revalidate: 3600 },
);

export const getContactChannels = unstable_cache(
  () =>
    safe<ContactChannel[]>("contact", [], async () => {
      const { data, error } = await getPublicSupabase().from("contact_channels").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as ContactChannel[];
    }),
  ["contact"],
  { tags: [TAGS.contact], revalidate: 3600 },
);

export const getPaymentMethods = unstable_cache(
  () =>
    safe<PaymentMethod[]>("payments", [], async () => {
      const { data, error } = await getPublicSupabase().from("payment_methods").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as PaymentMethod[];
    }),
  ["payments"],
  { tags: [TAGS.payments], revalidate: 3600 },
);

export const getBusinessHours = unstable_cache(
  () =>
    safe<BusinessHour[]>("hours", [], async () => {
      const { data, error } = await getPublicSupabase()
        .from("business_hours")
        .select("*")
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as BusinessHour[];
    }),
  ["hours"],
  { tags: [TAGS.hours], revalidate: 3600 },
);

export const getLegalDocuments = unstable_cache(
  () =>
    safe<LegalDocument[]>("legal", [], async () => {
      const { data, error } = await getPublicSupabase().from("legal_documents").select("*").order("slug");
      if (error) throw error;
      return (data ?? []) as LegalDocument[];
    }),
  ["legal"],
  { tags: [TAGS.legal], revalidate: 3600 },
);

export const LEGAL_SLUGS = ["privacidad", "terminos", "reservas", "cookies"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export const LEGAL_TITLES: Record<LegalSlug, string> = {
  privacidad: "Política de Tratamiento de Datos",
  terminos: "Términos y Condiciones",
  reservas: "Política de Reservas",
  cookies: "Aviso de Cookies",
};

/** Número de WhatsApp efectivo: canal activo o el de configuración. */
export function primaryWhatsApp(settings: Settings, channels: ContactChannel[]): string {
  const ch = channels.find((c) => c.type === "whatsapp" && c.active && c.value.replace(/\D/g, "").length >= 10);
  return ch ? ch.value.replace(/\D/g, "") : settings.whatsapp_number;
}
