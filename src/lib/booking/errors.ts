/** Traduce errores de Postgres/Supabase a mensajes claros en español. */
const FALLBACK: Record<string, string> = {
  ZP001: "Ese horario acaba de ser tomado, elige otro.",
  ZP002: "Ese horario ya pasó o no cumple la antelación mínima.",
  ZP003: "Ese horario no está disponible.",
  ZP004: "La fecha está fuera del rango permitido para reservar.",
  ZP005: "Revisa los servicios elegidos.",
  ZP006: "Ya tienes reservas pendientes de abono.",
  ZP007: "Ya no es posible hacer cambios a esta cita desde el sitio.",
  ZP008: "Alcanzaste el límite de reagendamientos.",
  ZP009: "No encontramos la cita.",
  ZP010: "El estado actual de la cita no permite esta acción.",
  ZP011: "No tienes permiso para esta acción.",
  ZP012: "Revisa los datos ingresados.",
  "23P01": "Ese horario se cruza con otra cita.",
  "23514": "Algún valor no cumple las reglas permitidas.",
  "23505": "Ya existe un registro con ese valor.",
  "23503": "No se puede eliminar porque hay registros que dependen de este.",
  "42501": "No tienes permiso para esta acción.",
};

export interface DbErrorLike {
  code?: string;
  message?: string;
}

export function dbErrorMessage(error: DbErrorLike | null | undefined): string {
  if (!error) return "Ocurrió un error inesperado.";
  const code = error.code ?? "";
  if (code.startsWith("ZP") && error.message) return error.message;
  return FALLBACK[code] ?? "Ocurrió un error inesperado. Intenta de nuevo.";
}
