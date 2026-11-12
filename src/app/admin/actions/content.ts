"use server";

import { z } from "zod";
import { adminAction, check, DbError, invalidate } from "@/lib/admin/action";
import { TAGS, type CacheTag } from "@/lib/data/public";
import { SECTION_KEYS, sectionSchemas, type SectionKey } from "@/lib/content/sections";
import { MIN_DEPOSIT_PERCENT } from "@/lib/booking/money";
import { CONTACT_TYPES } from "@/lib/types";
import { slugify } from "@/lib/utils";

const id = z.uuid();
const optionalId = z.uuid().optional();
const urlOrEmpty = z.union([z.literal(""), z.url("URL inválida").max(600)]);
const MEDIA_PATH = /^[a-z0-9/_.-]+$/;

/* -----------------------------------------------------------------------------
   Reordenar (arrastrar y soltar)
   ----------------------------------------------------------------------------- */
const SORTABLE: Record<string, { tag: CacheTag; path: string }> = {
  service_categories: { tag: TAGS.services, path: "/admin/servicios" },
  services: { tag: TAGS.services, path: "/admin/servicios" },
  gallery_items: { tag: TAGS.gallery, path: "/admin/galeria" },
  contact_channels: { tag: TAGS.contact, path: "/admin/contacto" },
  payment_methods: { tag: TAGS.payments, path: "/admin/pagos" },
};

export const reorderRows = adminAction(
  z.object({
    table: z.enum(["service_categories", "services", "gallery_items", "contact_channels", "payment_methods"]),
    ids: z.array(id).min(1).max(500),
  }),
  async ({ table, ids }, { supabase }) => {
    const results = await Promise.all(
      ids.map((rowId, index) => supabase.from(table).update({ sort_order: index + 1 }).eq("id", rowId)),
    );
    for (const r of results) check(r);
    const meta = SORTABLE[table]!;
    invalidate([meta.tag], [meta.path]);
    return null;
  },
);

/* -----------------------------------------------------------------------------
   Categorías y servicios
   ----------------------------------------------------------------------------- */
export const saveCategory = adminAction(
  z.object({
    id: optionalId,
    name: z.string().trim().min(1, "Escribe el nombre.").max(60),
    description: z.string().trim().max(300).default(""),
    active: z.boolean(),
  }),
  async (input, { supabase }) => {
    const row = { name: input.name, description: input.description, active: input.active };
    if (input.id) {
      check(await supabase.from("service_categories").update(row).eq("id", input.id));
    } else {
      const base = slugify(input.name) || "categoria";
      const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { count } = await supabase.from("service_categories").select("id", { count: "exact", head: true });
      check(await supabase.from("service_categories").insert({ ...row, slug, sort_order: (count ?? 0) + 1 }));
    }
    invalidate([TAGS.services], ["/admin/servicios"]);
    return null;
  },
);

export const deleteCategory = adminAction(z.object({ id }), async ({ id: catId }, { supabase }) => {
  check(await supabase.from("service_categories").delete().eq("id", catId));
  invalidate([TAGS.services], ["/admin/servicios"]);
  return null;
});

export const saveService = adminAction(
  z
    .object({
      id: optionalId,
      category_id: id,
      name: z.string().trim().min(1, "Escribe el nombre.").max(80),
      description: z.string().trim().max(400).default(""),
      price: z.coerce.number().int("El precio debe ser un entero.").min(0).max(10_000_000),
      price_type: z.enum(["fixed", "addon"]),
      duration_minutes: z.coerce.number().int().min(5, "Mínimo 5 minutos.").max(600),
      image_url: z.union([z.literal(""), z.url()]).optional(),
      active: z.boolean(),
      requires_any_service_ids: z.array(id).max(50).default([]),
    })
    .refine((s) => !(s.id && s.requires_any_service_ids.includes(s.id)), {
      message: "Un servicio no puede depender de sí mismo.",
    }),
  async (input, { supabase }) => {
    const row = {
      category_id: input.category_id,
      name: input.name,
      description: input.description,
      price: input.price,
      price_type: input.price_type,
      duration_minutes: input.duration_minutes,
      image_url: input.image_url || null,
      active: input.active,
      requires_any_service_ids: input.price_type === "addon" ? input.requires_any_service_ids : [],
    };
    if (input.id) {
      check(await supabase.from("services").update(row).eq("id", input.id));
    } else {
      const { count } = await supabase.from("services").select("id", { count: "exact", head: true });
      check(await supabase.from("services").insert({ ...row, sort_order: (count ?? 0) + 1 }));
    }
    invalidate([TAGS.services], ["/admin/servicios"]);
    return null;
  },
);

export const deleteService = adminAction(z.object({ id }), async ({ id: svcId }, { supabase }) => {
  check(await supabase.from("services").delete().eq("id", svcId));
  invalidate([TAGS.services], ["/admin/servicios"]);
  return null;
});

/* -----------------------------------------------------------------------------
   Horarios y bloqueos
   ----------------------------------------------------------------------------- */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM).");

export const saveBusinessHours = adminAction(
  z
    .object({
      weekday: z.number().int().min(0).max(6),
      ranges: z.array(z.object({ start: hhmm, end: hhmm })).max(6),
    })
    .superRefine((v, ctx) => {
      const sorted = [...v.ranges].sort((a, b) => a.start.localeCompare(b.start));
      sorted.forEach((r, i) => {
        if (r.end <= r.start) ctx.addIssue({ code: "custom", message: `El rango ${r.start}–${r.end} termina antes de empezar.` });
        const next = sorted[i + 1];
        if (next && next.start < r.end) ctx.addIssue({ code: "custom", message: "Hay rangos que se cruzan." });
      });
    }),
  async ({ weekday, ranges }, { supabase }) => {
    check(await supabase.from("business_hours").delete().eq("weekday", weekday));
    if (ranges.length > 0) {
      check(
        await supabase
          .from("business_hours")
          .insert(ranges.map((r) => ({ weekday, start_time: r.start, end_time: r.end }))),
      );
    }
    invalidate([TAGS.hours], ["/admin/horarios"]);
    return null;
  },
);

export const createTimeOff = adminAction(
  z
    .object({
      startAt: z.iso.datetime({ offset: true }),
      endAt: z.iso.datetime({ offset: true }),
      reason: z.string().trim().max(120).default(""),
    })
    .refine((v) => new Date(v.endAt) > new Date(v.startAt), { message: "El fin debe ser posterior al inicio." }),
  async (input, { supabase }) => {
    check(await supabase.from("time_off").insert({ start_at: input.startAt, end_at: input.endAt, reason: input.reason }));
    invalidate([TAGS.hours], ["/admin/horarios"]);
    return null;
  },
);

export const deleteTimeOff = adminAction(z.object({ id }), async ({ id: rowId }, { supabase }) => {
  check(await supabase.from("time_off").delete().eq("id", rowId));
  invalidate([TAGS.hours], ["/admin/horarios"]);
  return null;
});

/* -----------------------------------------------------------------------------
   Secciones de la landing
   ----------------------------------------------------------------------------- */
const sectionKey = z.enum(SECTION_KEYS as [SectionKey, ...SectionKey[]]);

export const saveSection = adminAction(
  z.object({ key: sectionKey, content: z.unknown() }),
  async ({ key, content }, { supabase }) => {
    const parsed = sectionSchemas[key].safeParse(content);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new DbError({
        code: "ZP012",
        message: `${issue?.message ?? "Contenido inválido"}${issue?.path.length ? ` (${issue.path.join(" › ")})` : ""}`,
      });
    }
    check(
      await supabase
        .from("site_sections")
        .upsert({ key, content: parsed.data }, { onConflict: "key" }),
    );
    invalidate([TAGS.sections], ["/admin/contenido"]);
    return null;
  },
);

export const setSectionVisibility = adminAction(
  z.object({ key: sectionKey, visible: z.boolean() }),
  async ({ key, visible }, { supabase }) => {
    check(await supabase.from("site_sections").update({ visible }).eq("key", key));
    invalidate([TAGS.sections], ["/admin/contenido"]);
    return null;
  },
);

export const reorderSections = adminAction(z.object({ keys: z.array(sectionKey).min(1) }), async ({ keys }, { supabase }) => {
  const results = await Promise.all(
    keys.map((key, i) => supabase.from("site_sections").update({ sort_order: i + 1 }).eq("key", key)),
  );
  for (const r of results) check(r);
  invalidate([TAGS.sections], ["/admin/contenido"]);
  return null;
});

/* -----------------------------------------------------------------------------
   Galería
   ----------------------------------------------------------------------------- */
const galleryFields = {
  alt: z.string().trim().min(1, "El texto alternativo es obligatorio.").max(200),
  title: z.string().trim().max(120).default(""),
  category: z.string().trim().max(40).default(""),
  visible: z.boolean().default(true),
};

export const createGalleryItems = adminAction(
  z.object({
    items: z
      .array(
        z.object({
          storage_path: z.string().regex(MEDIA_PATH).max(200),
          image_url: z.url(),
          width: z.number().int().positive().max(10000).nullable(),
          height: z.number().int().positive().max(10000).nullable(),
          ...galleryFields,
        }),
      )
      .min(1)
      .max(30),
  }),
  async ({ items }, { supabase }) => {
    const { data: last } = await supabase
      .from("gallery_items")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const start = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;
    check(await supabase.from("gallery_items").insert(items.map((it, i) => ({ ...it, sort_order: start + i }))));
    invalidate([TAGS.gallery], ["/admin/galeria"]);
    return null;
  },
);

export const updateGalleryItem = adminAction(z.object({ id, ...galleryFields }), async (input, { supabase }) => {
  const { id: rowId, ...rest } = input;
  check(await supabase.from("gallery_items").update(rest).eq("id", rowId));
  invalidate([TAGS.gallery], ["/admin/galeria"]);
  return null;
});

export const deleteGalleryItem = adminAction(z.object({ id }), async ({ id: rowId }, { supabase }) => {
  const row = check(
    await supabase.from("gallery_items").select("storage_path").eq("id", rowId).maybeSingle(),
  ) as { storage_path: string | null } | null;
  if (row?.storage_path) {
    // Borra también el archivo del bucket.
    const { error } = await supabase.storage.from("media").remove([row.storage_path]);
    if (error) console.error("[galería] no se pudo borrar el archivo:", error.message);
  }
  check(await supabase.from("gallery_items").delete().eq("id", rowId));
  invalidate([TAGS.gallery], ["/admin/galeria"]);
  return null;
});

/** Borra un archivo subido que ya no se usa (por ejemplo, al reemplazar una imagen). */
export const deleteMedia = adminAction(
  z.object({ path: z.string().regex(MEDIA_PATH).max(200) }),
  async ({ path }, { supabase }) => {
    await supabase.storage.from("media").remove([path]);
    return null;
  },
);

/* -----------------------------------------------------------------------------
   Contacto y redes
   ----------------------------------------------------------------------------- */
export const saveContactChannel = adminAction(
  z.object({
    id: optionalId,
    type: z.enum(CONTACT_TYPES),
    label: z.string().trim().min(1, "Escribe una etiqueta.").max(60),
    value: z.string().trim().max(200).default(""),
    url: urlOrEmpty.default(""),
    active: z.boolean(),
  }),
  async (input, { supabase }) => {
    const { id: rowId, ...row } = input;
    if (rowId) check(await supabase.from("contact_channels").update(row).eq("id", rowId));
    else {
      const { count } = await supabase.from("contact_channels").select("id", { count: "exact", head: true });
      check(await supabase.from("contact_channels").insert({ ...row, sort_order: (count ?? 0) + 1 }));
    }
    invalidate([TAGS.contact], ["/admin/contacto"]);
    return null;
  },
);

export const deleteContactChannel = adminAction(z.object({ id }), async ({ id: rowId }, { supabase }) => {
  check(await supabase.from("contact_channels").delete().eq("id", rowId));
  invalidate([TAGS.contact], ["/admin/contacto"]);
  return null;
});

/* -----------------------------------------------------------------------------
   Medios de pago
   ----------------------------------------------------------------------------- */
export const savePaymentMethod = adminAction(
  z.object({
    id: optionalId,
    name: z.string().trim().min(1, "Escribe el nombre.").max(60),
    account_number: z.string().trim().min(1, "Escribe el número o llave.").max(60),
    holder: z.string().trim().max(80).default(""),
    instructions: z.string().trim().max(300).default(""),
    qr_url: z.union([z.literal(""), z.url()]).optional(),
    active: z.boolean(),
  }),
  async (input, { supabase }) => {
    const { id: rowId, ...rest } = input;
    const row = { ...rest, qr_url: rest.qr_url || null };
    if (rowId) check(await supabase.from("payment_methods").update(row).eq("id", rowId));
    else {
      const { count } = await supabase.from("payment_methods").select("id", { count: "exact", head: true });
      check(await supabase.from("payment_methods").insert({ ...row, sort_order: (count ?? 0) + 1 }));
    }
    invalidate([TAGS.payments], ["/admin/pagos"]);
    return null;
  },
);

export const deletePaymentMethod = adminAction(z.object({ id }), async ({ id: rowId }, { supabase }) => {
  check(await supabase.from("payment_methods").delete().eq("id", rowId));
  invalidate([TAGS.payments], ["/admin/pagos"]);
  return null;
});

/* -----------------------------------------------------------------------------
   Documentos legales
   ----------------------------------------------------------------------------- */
export const saveLegalDocument = adminAction(
  z.object({
    slug: z.enum(["privacidad", "terminos", "reservas", "cookies"]),
    title: z.string().trim().min(3).max(120),
    content_md: z.string().max(60_000),
    version: z.string().trim().regex(/^\d+(\.\d+){0,2}$/, "Usa un formato de versión como 1.0 o 1.2.1"),
  }),
  async (input, { supabase }) => {
    check(
      await supabase
        .from("legal_documents")
        .update({ title: input.title, content_md: input.content_md, version: input.version, updated_at: new Date().toISOString() })
        .eq("slug", input.slug),
    );
    invalidate([TAGS.legal], ["/admin/legales"]);
    return null;
  },
);

/* -----------------------------------------------------------------------------
   Configuración general
   ----------------------------------------------------------------------------- */
const int = (min: number, max: number, label: string) =>
  z.coerce.number().int(`${label}: debe ser un número entero.`).min(min, `${label}: mínimo ${min}.`).max(max, `${label}: máximo ${max}.`);

export const saveSettings = adminAction(
  z.object({
    salon_name: z.string().trim().min(1).max(80),
    tagline: z.string().trim().max(160),
    address: z.string().trim().max(160),
    city: z.string().trim().max(80),
    whatsapp_number: z.string().regex(/^\d{10,13}$/, "WhatsApp: solo números, 10 dígitos."),
    deposit_percent: int(MIN_DEPOSIT_PERCENT, 100, "Abono"),
    hold_minutes: int(10, 1440, "Reserva temporal"),
    min_notice_minutes: int(0, 10080, "Antelación mínima"),
    max_advance_days: int(1, 365, "Horizonte"),
    slot_interval_minutes: int(5, 240, "Intervalo"),
    buffer_minutes: int(0, 240, "Preparación"),
    change_cutoff_hours: int(0, 336, "Plazo de cambios"),
    max_reschedules: int(0, 10, "Reagendamientos"),
    max_pending_per_phone: int(1, 10, "Pendientes por teléfono"),
    cancellation_refund_mode: z.enum(["credit", "refund"]),
  }),
  async (input, { supabase }) => {
    check(await supabase.from("settings").update(input).eq("id", 1));
    invalidate([TAGS.settings], ["/admin/configuracion", "/admin"]);
    return null;
  },
);
