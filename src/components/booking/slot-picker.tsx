"use client";

import * as React from "react";
import { CalendarX2, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import {
  addDaysToKey,
  bogotaDateKey,
  bogotaHHmm,
  bogotaToday,
  calendarDateToKey,
  formatDayKey,
  formatTime,
  keyToCalendarDate,
} from "@/lib/booking/time";

export interface SlotPickerProps {
  /** Devuelve las fechas (YYYY-MM-DD) con al menos un cupo en el rango. */
  fetchDays: (from: string, to: string) => Promise<string[]>;
  /** Devuelve los inicios (ISO) disponibles de un día. */
  fetchSlots: (day: string) => Promise<string[]>;
  maxAdvanceDays: number;
  value: string | null;
  onChange: (slotIso: string | null) => void;
  /** Cambia cuando cambian los servicios: fuerza recarga. */
  resetKey?: string;
  allowPast?: boolean;
}

function monthBounds(month: Date): { from: string; to: string } {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  return { from: calendarDateToKey(first), to: calendarDateToKey(last) };
}

export function SlotPicker({
  fetchDays,
  fetchSlots,
  maxAdvanceDays,
  value,
  onChange,
  resetKey = "",
  allowPast = false,
}: SlotPickerProps) {
  const today = bogotaToday();
  const maxDay = addDaysToKey(today, maxAdvanceDays);
  const [month, setMonth] = React.useState<Date>(() => keyToCalendarDate(today));
  const [availableDays, setAvailableDays] = React.useState<Set<string>>(new Set());
  const [loadedMonths, setLoadedMonths] = React.useState<Set<string>>(new Set());
  const [failedMonth, setFailedMonth] = React.useState<string | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<string | null>(value ? bogotaDateKey(value) : null);
  const [slotState, setSlotState] = React.useState<{ key: string; slots: string[] | null } | null>(null);

  // Reiniciar cuando cambian los servicios (ajuste de estado durante el render, sin efecto).
  const [prevResetKey, setPrevResetKey] = React.useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setAvailableDays(new Set());
    setLoadedMonths(new Set());
    setFailedMonth(null);
    setSelectedDay(null);
    setSlotState(null);
  }

  const monthKey = calendarDateToKey(month).slice(0, 7);
  const loadingDays = !loadedMonths.has(monthKey) && failedMonth !== monthKey;
  const slotKey = selectedDay ? `${selectedDay}|${resetKey}` : null;
  const currentSlots = slotState && slotState.key === slotKey ? slotState : null;
  const slots = currentSlots?.slots ?? null;
  const loadingSlots = selectedDay !== null && currentSlots === null;
  const error =
    failedMonth === monthKey
      ? "No pudimos cargar la disponibilidad. Revisa tu conexión."
      : currentSlots && currentSlots.slots === null
        ? "No pudimos cargar los horarios."
        : null;

  React.useEffect(() => {
    if (loadedMonths.has(monthKey)) return;
    let cancelled = false;
    const { from, to } = monthBounds(month);
    fetchDays(from, to)
      .then((days) => {
        if (cancelled) return;
        setAvailableDays((prev) => new Set([...prev, ...days]));
        setLoadedMonths((prev) => new Set([...prev, monthKey]));
        // Auto-seleccionar el primer día disponible para ahorrar un clic.
        if (!selectedDay && days.length > 0 && monthKey === today.slice(0, 7)) {
          setSelectedDay(days[0]!);
        }
      })
      .catch(() => {
        if (!cancelled) setFailedMonth(monthKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, loadedMonths, fetchDays]);

  React.useEffect(() => {
    if (!selectedDay) return;
    let cancelled = false;
    const key = `${selectedDay}|${resetKey}`;
    fetchSlots(selectedDay)
      .then((s) => {
        if (!cancelled) setSlotState({ key, slots: s });
      })
      .catch(() => {
        if (!cancelled) setSlotState({ key, slots: null });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDay, fetchSlots, resetKey]);

  const isDisabled = React.useCallback(
    (date: Date) => {
      const key = calendarDateToKey(date);
      if (!allowPast && key < today) return true;
      if (!allowPast && key > maxDay) return true;
      const mk = key.slice(0, 7);
      if (!loadedMonths.has(mk)) return true;
      return !availableDays.has(key);
    },
    [today, maxDay, loadedMonths, availableDays, allowPast],
  );

  const morning = (slots ?? []).filter((s) => Number(bogotaHHmm(s).slice(0, 2)) < 12);
  const afternoon = (slots ?? []).filter((s) => Number(bogotaHHmm(s).slice(0, 2)) >= 12);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8">
      <div className="relative rounded-2xl border bg-card p-3 sm:p-4">
        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          startMonth={allowPast ? undefined : keyToCalendarDate(today)}
          endMonth={allowPast ? undefined : keyToCalendarDate(maxDay)}
          selected={selectedDay ? keyToCalendarDate(selectedDay) : undefined}
          onSelect={(d) => {
            if (!d) return;
            setSelectedDay(calendarDateToKey(d));
            onChange(null);
          }}
          disabled={isDisabled}
        />
        {loadingDays ? (
          <div className="absolute right-4 bottom-3 flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <Loader2 className="size-3.5 animate-spin" /> Buscando cupos…
          </div>
        ) : null}
      </div>

      <div aria-live="polite">
        {error ? <p className="mb-3 text-sm text-destructive-text">{error}</p> : null}
        {!selectedDay ? (
          <EmptyHint loading={loadingDays} />
        ) : (
          <div>
            <h3 className="mb-3 text-sm font-semibold capitalize text-foreground">{formatDayKey(selectedDay)}</h3>
            {loadingSlots ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }, (_, i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            ) : slots === null ? null : slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                <CalendarX2 className="mx-auto mb-2 size-6" aria-hidden />
                No quedan cupos este día para la duración elegida. Prueba con otra fecha.
              </div>
            ) : (
              <div className="grid gap-4">
                <SlotGroup label="Mañana" slots={morning} value={value} onChange={onChange} />
                <SlotGroup label="Tarde" slots={afternoon} value={value} onChange={onChange} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyHint({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {loading ? "Cargando disponibilidad…" : "Elige un día en el calendario para ver los horarios disponibles."}
    </div>
  );
}

function SlotGroup({
  label,
  slots,
  value,
  onChange,
}: {
  label: string;
  slots: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4">
        {slots.map((s) => {
          const selected = value !== null && new Date(value).getTime() === new Date(s).getTime();
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              aria-pressed={selected}
              className={cn(
                "h-11 rounded-xl border text-sm font-semibold tabular-nums transition-all focus-visible:outline-2 focus-visible:outline-ring",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "bg-background hover:border-brand hover:text-brand",
              )}
            >
              {formatTime(s)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
