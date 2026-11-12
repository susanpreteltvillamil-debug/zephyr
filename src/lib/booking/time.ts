import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

/** Zona horaria fija del negocio (UTC-5, sin horario de verano). */
export const TZ = "America/Bogota";

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

/** YYYY-MM-DD en Bogotá para un instante. */
export function bogotaDateKey(date: Date | string = new Date()): string {
  return formatInTimeZone(new Date(date), TZ, "yyyy-MM-dd");
}

export function bogotaToday(now: Date = new Date()): string {
  return bogotaDateKey(now);
}

/** Suma días a una fecha YYYY-MM-DD (aritmética de calendario pura). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Instante UTC para una fecha y hora local de Bogotá. */
export function bogotaToUtc(dateKey: string, hhmm: string): Date {
  return fromZonedTime(`${dateKey}T${hhmm.length === 5 ? `${hhmm}:00` : hhmm}`, TZ);
}

/** YYYY-MM-DD → Date local a mediodía (para react-day-picker). */
export function keyToCalendarDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

/** Date local del calendario → YYYY-MM-DD */
export function calendarDateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatTime(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "h:mm aaa", { locale: es });
}

export function formatDateLong(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "EEEE d 'de' MMMM", { locale: es });
}

export function formatDateTimeLong(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "EEEE d 'de' MMMM 'a las' h:mm aaa", { locale: es });
}

export function formatDateShort(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "d MMM yyyy, h:mm aaa", { locale: es });
}

export function formatDayKey(key: string, pattern = "EEEE d 'de' MMMM"): string {
  return formatInTimeZone(bogotaToUtc(key, "12:00"), TZ, pattern, { locale: es });
}

/** HH:mm de un instante en Bogotá. */
export function bogotaHHmm(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "HH:mm");
}

/** Día de la semana (0 = domingo) de una fecha YYYY-MM-DD. */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function hoursUntil(date: Date | string, now: Date = new Date()): number {
  return (new Date(date).getTime() - now.getTime()) / 3_600_000;
}

/** ¿Se puede cambiar/cancelar? Espejo de la regla del servidor (solo para la UI). */
export function canChangeAppointment(startAt: Date | string, cutoffHours: number, now: Date = new Date()): boolean {
  return hoursUntil(startAt, now) >= cutoffHours;
}

export function rangeOfKeys(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDaysToKey(from, i));
}

/** "09:00:00" → "9:00 a. m." */
export function formatClock(time: string): string {
  return formatTime(bogotaToUtc("2026-01-05", time.slice(0, 5)));
}
