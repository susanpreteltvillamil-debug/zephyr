import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/shell";
import { AppointmentActions } from "@/components/admin/appointment-actions";
import { Button } from "@/components/ui/button";
import { StatusBadge, STATUS_META } from "@/components/ui/badge";
import { formatCOP } from "@/lib/booking/money";
import { formatPhone, normalizePhone } from "@/lib/booking/phone";
import { addDaysToKey, bogotaToUtc, formatDateShort } from "@/lib/booking/time";
import { cn } from "@/lib/utils";
import type { AppointmentStatus, AppointmentWithServices } from "@/lib/types";

export const metadata = { title: "Citas" };

const STATUSES = Object.keys(STATUS_META) as AppointmentStatus[];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CitasPage({ searchParams }: PageProps<"/admin/citas">) {
  const { supabase } = await requireAdminPage();
  await supabase.rpc("expire_stale_holds");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const status = typeof sp.status === "string" && (STATUSES as string[]).includes(sp.status) ? (sp.status as AppointmentStatus) : "";
  const from = typeof sp.from === "string" && DATE_RE.test(sp.from) ? sp.from : "";
  const to = typeof sp.to === "string" && DATE_RE.test(sp.to) ? sp.to : "";

  let query = supabase
    .from("appointments")
    .select("*, appointment_services(*), customers(credit_balance)")
    .order("start_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("start_at", bogotaToUtc(from, "00:00").toISOString());
  if (to) query = query.lt("start_at", bogotaToUtc(addDaysToKey(to, 1), "00:00").toISOString());
  if (q) {
    // Escapamos los caracteres especiales de PostgREST.
    const safe = q.replace(/[%,()*\\]/g, " ");
    const phone = normalizePhone(q);
    const ors = [`customer_name.ilike.%${safe}%`, `code.ilike.%${safe}%`];
    if (phone.length >= 3) ors.push(`customer_phone.ilike.%${phone}%`);
    query = query.or(ors.join(","));
  }
  const { data, error } = await query;
  const rows = (data ?? []) as AppointmentWithServices[];

  return (
    <>
      <PageHeader
        title="Citas"
        description="Busca, filtra y gestiona todas las reservas."
        actions={
          <Button asChild>
            <Link href="/admin/citas/nueva">
              <Plus /> Nueva cita
            </Link>
          </Button>
        }
      />

      <form className="mb-4 grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
        <label className="relative">
          <span className="sr-only">Buscar por cliente, teléfono o código</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Cliente, teléfono o código"
            className="h-10 w-full rounded-xl border border-input bg-background pr-3 pl-9 text-sm"
          />
        </label>
        <label>
          <span className="sr-only">Estado</span>
          <select name="status" defaultValue={status} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
            <option value="">Todos los estados</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Desde</span>
          <input type="date" name="from" defaultValue={from} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" />
        </label>
        <label>
          <span className="sr-only">Hasta</span>
          <input type="date" name="to" defaultValue={to} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" />
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="h-10 flex-1">
            Filtrar
          </Button>
          {q || status || from || to ? (
            <Button asChild size="sm" variant="ghost" className="h-10">
              <Link href="/admin/citas">Limpiar</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["", ...STATUSES] as const).map((s) => (
          <Link
            key={s || "all"}
            href={s ? `/admin/citas?status=${s}` : "/admin/citas"}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              status === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
            )}
          >
            {s ? STATUS_META[s].label : "Todas"}
          </Link>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive-text">No se pudieron cargar las citas.</p> : null}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No hay citas con esos filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[780px] text-sm">
            <caption className="sr-only">Listado de citas</caption>
            <thead className="border-b bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Fecha</th>
                <th scope="col" className="px-4 py-3 font-semibold">Cliente</th>
                <th scope="col" className="px-4 py-3 font-semibold">Servicios</th>
                <th scope="col" className="px-4 py-3 font-semibold">Abono</th>
                <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((a) => (
                <tr key={a.id} className={cn("align-top", a.status === "pending_payment" && "bg-warning-soft/50")}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="block font-medium">{formatDateShort(a.start_at)}</span>
                    <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{a.customer_name}</span>
                    <span className="text-xs text-muted-foreground">{formatPhone(a.customer_phone)}</span>
                  </td>
                  <td className="max-w-56 px-4 py-3 text-muted-foreground">
                    {a.appointment_services.map((s) => s.name).join(" + ")}
                    <span className="block text-xs">Total {formatCOP(a.total_price)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatCOP(a.deposit_amount)}
                    <span className={cn("block text-xs", a.deposit_paid ? "text-success-foreground" : "text-muted-foreground")}>
                      {a.deposit_paid ? "Recibido" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                    {a.source === "admin" ? <span className="mt-1 block text-xs text-muted-foreground">Manual</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <AppointmentActions appointment={a} compact />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 200 ? (
        <p className="mt-3 text-xs text-muted-foreground">Se muestran las 200 más recientes. Usa los filtros para acotar.</p>
      ) : null}
    </>
  );
}
