import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import { AppointmentActions } from "@/components/admin/appointment-actions";
import { Button } from "@/components/ui/button";
import {
  addDaysToKey,
  bogotaHHmm,
  bogotaDateKey,
  bogotaToUtc,
  bogotaToday,
  formatDayKey,
  formatTime,
  weekdayOfKey,
} from "@/lib/booking/time";
import { cn } from "@/lib/utils";
import type { AppointmentStatus, AppointmentWithServices, BusinessHour } from "@/lib/types";

export const metadata = { title: "Calendario" };

type View = "day" | "week" | "month";

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending_payment: "border-warning bg-warning-soft text-warning-foreground",
  confirmed: "border-success bg-success-soft text-success-foreground",
  completed: "border-primary bg-accent text-accent-foreground",
  no_show: "border-destructive bg-destructive-soft text-destructive-text",
  cancelled: "border-destructive bg-destructive-soft text-destructive-text line-through opacity-75",
  expired: "border-border bg-muted text-muted-foreground opacity-70",
};

function startOfWeek(key: string): string {
  const wd = weekdayOfKey(key); // 0 = domingo
  return addDaysToKey(key, wd === 0 ? -6 : 1 - wd);
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendario">) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const view: View = sp.view === "day" || sp.view === "month" ? sp.view : "week";
  const today = bogotaToday();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const showInactive = sp.all === "1";

  let rangeStart: string;
  let rangeDays: number;
  if (view === "day") {
    rangeStart = date;
    rangeDays = 1;
  } else if (view === "week") {
    rangeStart = startOfWeek(date);
    rangeDays = 7;
  } else {
    const first = `${date.slice(0, 7)}-01`;
    rangeStart = startOfWeek(first);
    rangeDays = 42;
  }
  const rangeEnd = addDaysToKey(rangeStart, rangeDays);

  let q = supabase
    .from("appointments")
    .select("*, appointment_services(*), customers(credit_balance)")
    .gte("start_at", bogotaToUtc(rangeStart, "00:00").toISOString())
    .lt("start_at", bogotaToUtc(rangeEnd, "00:00").toISOString())
    .order("start_at");
  if (!showInactive) q = q.in("status", ["pending_payment", "confirmed", "completed", "no_show"]);
  const [{ data }, hoursRes] = await Promise.all([q, supabase.from("business_hours").select("*")]);
  const appts = (data ?? []) as AppointmentWithServices[];
  const hours = (hoursRes.data ?? []) as BusinessHour[];

  const byDay = new Map<string, AppointmentWithServices[]>();
  for (const a of appts) {
    const k = bogotaDateKey(a.start_at);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }

  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const prev = view === "month" ? shiftMonth(date, -1) : addDaysToKey(date, -step);
  const next = view === "month" ? shiftMonth(date, 1) : addDaysToKey(date, step);
  const href = (v: View, d: string) => `/admin/calendario?view=${v}&date=${d}${showInactive ? "&all=1" : ""}`;

  const title =
    view === "day"
      ? formatDayKey(date, "EEEE d 'de' MMMM yyyy")
      : view === "week"
        ? `${formatDayKey(rangeStart, "d MMM")} – ${formatDayKey(addDaysToKey(rangeStart, 6), "d MMM yyyy")}`
        : formatDayKey(`${date.slice(0, 7)}-15`, "MMMM yyyy");

  // Rango horario visible (día/semana)
  const opens = hours.map((h) => minutesOf(h.start_time));
  const closes = hours.map((h) => minutesOf(h.end_time));
  const apptMins = appts.flatMap((a) => [minutesOf(bogotaHHmm(a.start_at)), minutesOf(bogotaHHmm(a.end_at)) || 24 * 60]);
  const dayStart = Math.floor(Math.min(8 * 60, ...opens, ...apptMins) / 60) * 60;
  const dayEnd = Math.ceil(Math.max(19 * 60, ...closes, ...apptMins) / 60) * 60;
  const PX_PER_MIN = 1.1;

  return (
    <>
      <PageHeader title="Calendario" description="Verde: confirmada · Amarillo: pendiente de abono · Rojo: cancelada o no asistió." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Anterior">
            <Link href={href(view, prev)}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href(view, today)}>Hoy</Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="Siguiente">
            <Link href={href(view, next)}>
              <ChevronRight />
            </Link>
          </Button>
          <h2 className="ml-2 font-display text-xl font-semibold capitalize">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/calendario?view=${view}&date=${date}${showInactive ? "" : "&all=1"}`}
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            {showInactive ? "Ocultar canceladas/vencidas" : "Mostrar canceladas/vencidas"}
          </Link>
          <div className="inline-flex rounded-full bg-muted p-1" role="group" aria-label="Vista">
            {(
              [
                ["day", "Día"],
                ["week", "Semana"],
                ["month", "Mes"],
              ] as const
            ).map(([v, label]) => (
              <Link
                key={v}
                href={href(v, date)}
                aria-current={view === v ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium",
                  view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {view === "month" ? (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <div className="grid min-w-[720px] grid-cols-7 border-b bg-muted/60 text-center text-xs font-semibold uppercase text-muted-foreground">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid min-w-[720px] grid-cols-7">
            {Array.from({ length: 42 }, (_, i) => {
              const k = addDaysToKey(rangeStart, i);
              const list = byDay.get(k) ?? [];
              const inMonth = k.slice(0, 7) === date.slice(0, 7);
              return (
                <Link
                  key={k}
                  href={href("day", k)}
                  className={cn(
                    "min-h-28 border-r border-b p-1.5 text-left transition-colors hover:bg-accent/60 [&:nth-child(7n)]:border-r-0",
                    !inMonth && "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                      k === today && "bg-primary text-primary-foreground",
                    )}
                  >
                    {Number(k.slice(8))}
                  </span>
                  <ul className="mt-1 grid gap-0.5">
                    {list.slice(0, 3).map((a) => (
                      <li key={a.id} className={cn("truncate rounded-md border-l-2 px-1.5 py-0.5 text-[11px]", STATUS_STYLE[a.status])}>
                        {formatTime(a.start_at)} {a.customer_name.split(" ")[0]}
                      </li>
                    ))}
                    {list.length > 3 ? <li className="px-1 text-[11px] text-muted-foreground">+{list.length - 3} más</li> : null}
                  </ul>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `3.5rem repeat(${rangeDays}, minmax(${view === "day" ? "16rem" : "9rem"}, 1fr))`,
              minWidth: view === "week" ? 900 : undefined,
            }}
          >
            <div className="sticky left-0 z-10 border-b bg-muted/60" />
            {Array.from({ length: rangeDays }, (_, i) => {
              const k = addDaysToKey(rangeStart, i);
              return (
                <Link
                  key={k}
                  href={href("day", k)}
                  className={cn("border-b border-l bg-muted/60 px-2 py-2 text-center text-xs font-semibold capitalize", k === today && "text-brand")}
                >
                  {formatDayKey(k, "EEE d")}
                </Link>
              );
            })}

            <div className="sticky left-0 z-10 bg-card" style={{ height: (dayEnd - dayStart) * PX_PER_MIN }}>
              {Array.from({ length: (dayEnd - dayStart) / 60 }, (_, i) => (
                <div key={i} className="relative border-b border-dashed text-right" style={{ height: 60 * PX_PER_MIN }}>
                  <span className="absolute -top-2 right-1.5 bg-card px-0.5 text-[10px] text-muted-foreground">
                    {String(dayStart / 60 + i).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>
            {Array.from({ length: rangeDays }, (_, i) => {
              const k = addDaysToKey(rangeStart, i);
              const wd = weekdayOfKey(k);
              const open = hours.filter((h) => h.weekday === wd);
              return (
                <div key={k} className="relative border-l" style={{ height: (dayEnd - dayStart) * PX_PER_MIN }}>
                  {/* horario de atención sombreado */}
                  {open.map((h) => (
                    <div
                      key={h.id}
                      className="absolute inset-x-0 bg-accent/40"
                      style={{
                        top: (minutesOf(h.start_time) - dayStart) * PX_PER_MIN,
                        height: (minutesOf(h.end_time) - minutesOf(h.start_time)) * PX_PER_MIN,
                      }}
                      aria-hidden
                    />
                  ))}
                  {Array.from({ length: (dayEnd - dayStart) / 60 }, (_, j) => (
                    <div key={j} className="border-b border-dashed" style={{ height: 60 * PX_PER_MIN }} aria-hidden />
                  ))}
                  {(byDay.get(k) ?? []).map((a) => {
                    const top = (minutesOf(bogotaHHmm(a.start_at)) - dayStart) * PX_PER_MIN;
                    const height = Math.max(28, a.total_duration_minutes * PX_PER_MIN - 2);
                    return (
                      <div
                        key={a.id}
                        className={cn("absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-xs shadow-sm", STATUS_STYLE[a.status])}
                        style={{ top, height }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {formatTime(a.start_at)} · {a.customer_name}
                            </p>
                            {height > 44 ? (
                              <p className="truncate opacity-90">{a.appointment_services.map((s) => s.name).join(" + ")}</p>
                            ) : null}
                          </div>
                          {height > 40 ? <AppointmentActions appointment={a} compact /> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}
