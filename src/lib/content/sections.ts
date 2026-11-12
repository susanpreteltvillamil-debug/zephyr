import { z } from "zod";

/* =============================================================================
   Contenido editable de la landing. Cada sección tiene:
   - un esquema zod (validación al guardar y al leer)
   - un valor por defecto (si la BD no responde o el JSON es inválido)
   - una descripción de campos para generar el formulario del dashboard
   ============================================================================= */

const text = (max: number) => z.string().trim().max(max);
const image = z.object({
  url: z.union([z.literal(""), z.string().url().max(600)]),
  alt: text(200),
});

export const BENEFIT_ICONS = ["shield", "sparkles", "clock", "heart", "star", "leaf", "gem", "smile"] as const;

export const sectionSchemas = {
  hero: z.object({
    eyebrow: text(80),
    title: text(120).min(3),
    subtitle: text(400),
    primaryCta: text(40).min(2),
    secondaryCta: text(40).min(2),
    highlights: z.array(text(60).min(1)).max(4),
    image,
  }),
  benefits: z.object({
    title: text(100).min(3),
    subtitle: text(300),
    items: z
      .array(z.object({ icon: z.enum(BENEFIT_ICONS), title: text(60).min(2), description: text(240) }))
      .max(8),
  }),
  services: z.object({ title: text(100).min(3), subtitle: text(300), note: text(300) }),
  gallery: z.object({ title: text(100).min(3), subtitle: text(300) }),
  how_to_book: z.object({
    title: text(100).min(3),
    subtitle: text(300),
    steps: z.array(z.object({ title: text(60).min(2), description: text(240) })).min(1).max(5),
  }),
  testimonials: z.object({
    title: text(100).min(3),
    subtitle: text(300),
    items: z
      .array(
        z.object({
          name: text(60).min(2),
          service: text(60),
          text: text(500).min(5),
          rating: z.coerce.number().int().min(1).max(5),
        }),
      )
      .max(12),
  }),
  faq: z.object({
    title: text(100).min(3),
    subtitle: text(300),
    items: z.array(z.object({ question: text(160).min(5), answer: text(800).min(5) })).max(20),
  }),
  cta: z.object({ title: text(120).min(3), subtitle: text(300), buttonLabel: text(40).min(2) }),
  contact: z.object({ title: text(100).min(3), subtitle: text(300), showHours: z.boolean() }),
  footer: z.object({ tagline: text(160), copyright: text(160) }),
} as const;

export type SectionKey = keyof typeof sectionSchemas;
export type SectionContent<K extends SectionKey> = z.infer<(typeof sectionSchemas)[K]>;
export type AllSections = { [K in SectionKey]: SectionContent<K> };

export const SECTION_KEYS = Object.keys(sectionSchemas) as SectionKey[];

export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "Portada (hero)",
  benefits: "Beneficios / Por qué elegirnos",
  services: "Servicios y precios",
  gallery: "Galería",
  how_to_book: "Cómo reservar",
  testimonials: "Testimonios",
  faq: "Preguntas frecuentes",
  cta: "Llamado final (CTA)",
  contact: "Contacto",
  footer: "Pie de página",
};

/** Secciones fijas que no se pueden reordenar (siempre al inicio/final). */
export const FIXED_SECTIONS: SectionKey[] = ["hero", "footer"];

export const defaultSections: AllSections = {
  hero: {
    eyebrow: "Salón de uñas · Cita previa",
    title: "Uñas que hablan por ti, hechas con calma y precisión",
    subtitle:
      "Semipermanente, sistemas y pedicura con productos de calidad, herramientas esterilizadas y el tiempo que tus manos merecen. Reserva en 1 minuto y asegura tu cupo con un abono.",
    primaryCta: "Reserva tu cita",
    secondaryCta: "Escríbenos por WhatsApp",
    highlights: ["Herramientas esterilizadas", "Duración hasta 3 semanas", "Atención solo con cita"],
    image: { url: "", alt: "" },
  },
  benefits: {
    title: "Por qué elegir Zephyr",
    subtitle:
      "No es solo esmalte: es un ritual de cuidado pensado para que salgas feliz y tus uñas se mantengan sanas.",
    items: [
      {
        icon: "shield",
        title: "Higiene sin negociación",
        description: "Limas y pulidores de un solo uso, metal esterilizado y superficies desinfectadas en cada cita.",
      },
      {
        icon: "sparkles",
        title: "Acabado que dura",
        description: "Preparamos bien la uña natural para que el color y el brillo te acompañen por semanas.",
      },
      {
        icon: "clock",
        title: "Tu tiempo se respeta",
        description: "Atendemos solo con cita: sin filas, sin afanes y con la hora que tú elegiste.",
      },
      {
        icon: "heart",
        title: "Cuidamos tu uña natural",
        description: "Retiros suaves y técnicas que no debilitan. Belleza hoy y uñas sanas mañana.",
      },
    ],
  },
  services: {
    title: "Servicios y precios",
    subtitle:
      "Precios claros desde el inicio. Puedes combinar servicios, por ejemplo retiro + semipermanente, y ver el total al reservar.",
    note: "Los tiempos son aproximados y pueden variar según el diseño y el estado de tu uña.",
  },
  gallery: {
    title: "Nuestros trabajos",
    subtitle: "Resultados reales hechos en Zephyr. Inspírate para tu próxima cita.",
  },
  how_to_book: {
    title: "Reserva en 3 pasos",
    subtitle: "Rápido, claro y sin llamadas.",
    steps: [
      { title: "Elige tus servicios", description: "Combina lo que quieras y mira el precio y la duración total al instante." },
      { title: "Escoge fecha y hora", description: "Solo te mostramos horarios realmente disponibles." },
      {
        title: "Asegura con tu abono",
        description: "Paga el abono por Nequi, Daviplata o Llave y envíanos el comprobante por WhatsApp.",
      },
    ],
  },
  testimonials: {
    title: "Lo que dicen nuestras clientas",
    subtitle: "La mejor publicidad es una clienta que vuelve.",
    items: [
      {
        name: "Valentina R.",
        service: "Semipermanente",
        text: "Me duró impecable tres semanas y la atención fue súper puntual. Por fin un lugar donde no me toca esperar.",
        rating: 5,
      },
      {
        name: "Laura M.",
        service: "Poligel extensión",
        text: "Quedaron livianas y naturales, justo como las quería. Se nota el cuidado con la higiene.",
        rating: 5,
      },
      {
        name: "Daniela P.",
        service: "Pedicura con spa",
        text: "El spa de pies es un regalo. Salí relajada y con los pies divinos.",
        rating: 5,
      },
    ],
  },
  faq: {
    title: "Preguntas frecuentes",
    subtitle: "Todo claro antes de tu cita.",
    items: [
      {
        question: "¿Por qué piden un abono?",
        answer:
          "El abono (mínimo el 20 % del total) separa tu horario solo para ti. Se descuenta del valor final el día de tu cita.",
      },
      {
        question: "¿Cuánto tiempo tengo para pagar el abono?",
        answer:
          "Al reservar, tu cupo queda apartado temporalmente (2 horas por defecto). Si en ese tiempo no recibimos el comprobante, el horario se libera para otra persona.",
      },
      {
        question: "¿Puedo cambiar o cancelar mi cita?",
        answer:
          "Sí, desde el enlace privado que recibes al reservar, con al menos 24 horas de anticipación. Si cancelas a tiempo, tu abono queda como saldo a favor para tu próxima cita.",
      },
      {
        question: "¿Qué pasa si no asisto?",
        answer:
          "Si no asistes sin avisar con 24 horas de anticipación, el abono no se devuelve, porque ese horario se reservó solo para ti.",
      },
      {
        question: "¿Y si llego tarde?",
        answer:
          "Te esperamos hasta 15 minutos. Después de eso es posible que debamos ajustar el servicio para no afectar a la siguiente clienta, o reprogramar.",
      },
      {
        question: "¿Cuánto dura cada servicio?",
        answer:
          "Desde 30 minutos para un retiro hasta 2 horas y media para extensiones. Al reservar ves la duración total de lo que elijas.",
      },
      {
        question: "¿Cómo garantizan la higiene?",
        answer:
          "Esterilizamos el instrumental metálico, usamos limas y pulidores de un solo uso y desinfectamos la estación antes de cada clienta.",
      },
    ],
  },
  cta: {
    title: "Tus próximas uñas favoritas están a un clic",
    subtitle: "Elige tu horario ahora y llega directo a consentirte.",
    buttonLabel: "Reserva tu cita",
  },
  contact: { title: "Visítanos o escríbenos", subtitle: "Atendemos únicamente con cita previa.", showHours: true },
  footer: { tagline: "Uñas impecables, cuidado de verdad.", copyright: "Todos los derechos reservados." },
};

export function parseSection<K extends SectionKey>(key: K, content: unknown): SectionContent<K> {
  const result = sectionSchemas[key].safeParse(content);
  return (result.success ? result.data : defaultSections[key]) as SectionContent<K>;
}

/* -----------------------------------------------------------------------------
   Descriptores de campos → formularios generados automáticamente
   ----------------------------------------------------------------------------- */
export type FieldDescriptor =
  | { kind: "text"; name: string; label: string; max: number; hint?: string }
  | { kind: "textarea"; name: string; label: string; max: number; hint?: string }
  | { kind: "boolean"; name: string; label: string; hint?: string }
  | { kind: "image"; name: string; label: string; hint?: string }
  | { kind: "stringList"; name: string; label: string; max: number; itemMax: number; hint?: string }
  | { kind: "list"; name: string; label: string; max: number; itemLabel: string; fields: ItemField[]; hint?: string };

export type ItemField =
  | { kind: "text"; name: string; label: string; max: number }
  | { kind: "textarea"; name: string; label: string; max: number }
  | { kind: "select"; name: string; label: string; options: readonly string[] }
  | { kind: "number"; name: string; label: string; min: number; max: number };

const titleFields: FieldDescriptor[] = [
  { kind: "text", name: "title", label: "Título", max: 100 },
  { kind: "textarea", name: "subtitle", label: "Subtítulo", max: 300 },
];

export const sectionFields: Record<SectionKey, FieldDescriptor[]> = {
  hero: [
    { kind: "text", name: "eyebrow", label: "Texto superior", max: 80 },
    { kind: "text", name: "title", label: "Título principal", max: 120 },
    { kind: "textarea", name: "subtitle", label: "Subtítulo", max: 400 },
    { kind: "text", name: "primaryCta", label: "Botón principal", max: 40 },
    { kind: "text", name: "secondaryCta", label: "Botón de WhatsApp", max: 40 },
    { kind: "stringList", name: "highlights", label: "Puntos destacados", max: 4, itemMax: 60 },
    { kind: "image", name: "image", label: "Imagen principal", hint: "Recomendado: vertical 4:5, mínimo 1000 px." },
  ],
  benefits: [
    ...titleFields,
    {
      kind: "list",
      name: "items",
      label: "Beneficios",
      itemLabel: "Beneficio",
      max: 8,
      fields: [
        { kind: "select", name: "icon", label: "Ícono", options: BENEFIT_ICONS },
        { kind: "text", name: "title", label: "Título", max: 60 },
        { kind: "textarea", name: "description", label: "Descripción", max: 240 },
      ],
    },
  ],
  services: [...titleFields, { kind: "textarea", name: "note", label: "Nota al pie", max: 300 }],
  gallery: titleFields,
  how_to_book: [
    ...titleFields,
    {
      kind: "list",
      name: "steps",
      label: "Pasos",
      itemLabel: "Paso",
      max: 5,
      fields: [
        { kind: "text", name: "title", label: "Título", max: 60 },
        { kind: "textarea", name: "description", label: "Descripción", max: 240 },
      ],
    },
  ],
  testimonials: [
    ...titleFields,
    {
      kind: "list",
      name: "items",
      label: "Testimonios",
      itemLabel: "Testimonio",
      max: 12,
      fields: [
        { kind: "text", name: "name", label: "Nombre", max: 60 },
        { kind: "text", name: "service", label: "Servicio", max: 60 },
        { kind: "textarea", name: "text", label: "Testimonio", max: 500 },
        { kind: "number", name: "rating", label: "Calificación (1–5)", min: 1, max: 5 },
      ],
    },
  ],
  faq: [
    ...titleFields,
    {
      kind: "list",
      name: "items",
      label: "Preguntas",
      itemLabel: "Pregunta",
      max: 20,
      fields: [
        { kind: "text", name: "question", label: "Pregunta", max: 160 },
        { kind: "textarea", name: "answer", label: "Respuesta", max: 800 },
      ],
    },
  ],
  cta: [
    { kind: "text", name: "title", label: "Título", max: 120 },
    { kind: "textarea", name: "subtitle", label: "Subtítulo", max: 300 },
    { kind: "text", name: "buttonLabel", label: "Texto del botón", max: 40 },
  ],
  contact: [...titleFields, { kind: "boolean", name: "showHours", label: "Mostrar horario de atención" }],
  footer: [
    { kind: "text", name: "tagline", label: "Frase del pie", max: 160 },
    { kind: "text", name: "copyright", label: "Texto de derechos", max: 160 },
  ],
};
