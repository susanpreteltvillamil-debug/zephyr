import Link from "next/link";
import { CalendarCheck, CircleDollarSign, Clock, Hourglass, Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import { AppointmentCard } from "@/components/admin/appointment-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addDaysToKey, bogotaToUtc, bogotaToday, formatDayKey } from "@/lib/booking/time";
import { formatCOP } from "@/lib/booking/money";
import type { AppointmentWithServices } from "@/lib/types";

export const metadata = { title: "Resumen" };

const SELECT = "*, appointment_services(*), customers(credit_balance)";

export default async function AdminHome() {
  const { supabase } = await requireAdminPage();
  // Expiración perezosa también al abrir el panel.
  await supabase.rpc("expire_stale_holds");

  const today = bogotaToday();
  const startToday = bogotaToUtc(today, "00:00").toISOString();
  const startTomorrow = bogotaToUtc(addDaysToKey(today, 1), "00:00").toISOString();
  const in7 = bogotaToUtc(addDaysToKey(today, 8), "00:00").toISOString();
  const monthStart = bogotaToUtc(`${today.slice(0, 7)}-01`, "00:00").toISOString();

  const [todayRes, upcomingRes, pendingRes, depositsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(SELECT)
      .gte("start_at", startToday)
      .lt("start_at", startTomorrow)
      .in("status", ["pending_payment", "confirmed", "completed", "no_show"])
      .order("start_at"),
    supabase
      .from("appointments")
      .select(SELECT)
      .gte("start_at", startTomorrow)
      .lt("start_at", in7)
      .in("status", ["pending_payment", "confirmed"])
      .order("start_at")
      .limit(30),
    supabase.from("appointments").select(SELECT).eq("status", "pending_payment").order("hold_expires_at"),
    supabase
      .from("appointments")
      .select("deposit_amount, total_price, status")
      .eq("deposit_paid", true)
      .gte("start_at", monthStart),
  ]);

  const todayList = (todayRes.data ?? []) as AppointmentWithServices[];
  const upcoming = (upcomingRes.data ?? []) as AppointmentWithServices[];
  const pending = (pendingRes.data ?? []) as AppointmentWithServices[];
  const deposits = (depositsRes.data ?? []) as { deposit_amount: number; total_price: number; status: string }[];
  const depositsTotal = deposits.filter((d) => d.status !== "cancelled").reduce((s, d) => s + d.deposit_amount, 0);
  const expected = deposits
    .filter((d) => d.status === "confirmed" || d.status === "completed")
    .reduce((s, d) => s + d.total_price, 0);

  const stats = [
    { label: "Citas hoy", value: String(todayList.filter((a) => a.status !== "no_show").length), icon: CalendarCheck },
    { label: "Pendientes de abono", value: String(pending.length), icon: Hourglass, warn: pending.length > 0 },
    { label: "Abonos confirmados (mes)", value: formatCOP(depositsTotal), icon: CircleDollarSign },
    { label: "Ventas estimadas (mes)", value: formatCOP(expected), icon: Clock },
  ];

  return (
    <>
      <PageHeader
        title="Resumen"
        description={<span className="capitalize">{formatDayKey(today, "EEEE d 'de' MMMM 'de' yyyy")}</span>}
        actions={
          <Button asChild>
            <Link href="/admin/citas/nueva">
              <Plus /> Nueva cita
            </Link>
          </Button>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className={s.warn ? "border-warning/60 bg-warning-soft" : undefined}>
            <div className="p-4">
              <s.icon className={s.warn ? "size-5 text-warning-foreground" : "size-5 text-brand"} aria-hidden />
              <p className={`mt-3 font-display text-2xl font-semibold tabular-nums ${s.warn ? "text-warning-foreground" : ""}`}>
                {s.value}
              </p>
              <p className={`text-xs ${s.warn ? "text-warning-foreground" : "text-muted-foreground"}`}>{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {pending.length > 0 ? (
        <section className="mb-8" aria-labelledby="pending-title">
          <h2 id="pending-title" className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <span className="size-2.5 rounded-full bg-warning" aria-hidden /> Pendientes de abono
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((a) => (
              <AppointmentCard key={a.id} appointment={a} highlight />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="today-title">
          <h2 id="today-title" className="mb-3 text-lg font-semibold">
            Hoy
          </h2>
          {todayList.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              No hay citas para hoy.
            </p>
          ) : (
            <div className="grid gap-3">
              {todayList.map((a) => (
                <AppointmentCard key={a.id} appointment={a} />
              ))}
            </div>
          )}
        </section>
        <section aria-labelledby="next-title">
          <h2 id="next-title" className="mb-3 text-lg font-semibold">
            Próximos 7 días
          </h2>
          {upcoming.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              Sin citas próximas.
            </p>
          ) : (
            <div className="grid gap-3">
              {upcoming.map((a) => (
                <AppointmentCard key={a.id} appointment={a} showDate />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
