import { z } from "zod";
import { isValidColombianMobile } from "@/lib/booking/phone";

export const customerDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre completo.")
    .max(100, "El nombre es demasiado largo."),
  phone: z
    .string()
    .trim()
    .refine(isValidColombianMobile, "Escribe un celular colombiano válido de 10 dígitos (ej. 300 123 4567)."),
  email: z
    .union([z.literal(""), z.email("El correo no es válido.").max(120)])
    .optional()
    .transform((v) => v || undefined),
  notes: z.string().trim().max(500, "Máximo 500 caracteres.").optional().default(""),
  acceptPrivacy: z.boolean().refine((v) => v, "Debes aceptar la Política de Tratamiento de Datos."),
  acceptPolicy: z.boolean().refine((v) => v, "Debes aceptar la Política de Reservas."),
});

export type CustomerDetailsInput = z.input<typeof customerDetailsSchema>;

export const createBookingSchema = customerDetailsSchema.extend({
  serviceIds: z.array(z.uuid()).min(1, "Elige al menos un servicio.").max(10),
  startAt: z.iso.datetime({ offset: true }),
  /** Honeypot: debe llegar vacío. */
  website: z.string().max(0).optional().default(""),
  turnstileToken: z.string().max(4096).optional(),
});

export type CreateBookingInput = z.input<typeof createBookingSchema>;

export const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/, "Enlace inválido.");
export const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
